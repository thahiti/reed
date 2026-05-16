# PDF Export — Design

Date: 2026-05-16
Status: Approved (pending spec review)

## Goal

Add a "Export as PDF…" feature that saves the **currently active tab's rendered
markdown** to a PDF file.

## Decisions

| Aspect | Decision |
|--------|----------|
| Export content | Active tab's rendered markdown only (no tab bar / sidebar / toolbar) |
| Theme | Always Light, regardless of the app's current theme |
| Header / footer | None — content only |
| Save UX | Native save dialog every time; default filename = `<basename>.pdf` |
| Trigger | File menu item only (no keyboard shortcut) |

## Approach

Chosen: **offscreen renderer window + `webContents.printToPDF()`**.

A hidden `BrowserWindow` boots the same renderer entry point as the main window
but in a dedicated `#print` mode. It re-renders only the markdown content
through the existing pipeline with the light theme forced, then signals
readiness so the main process can call `printToPDF`.

Rejected alternatives:

- **Live DOM capture + inlined CSS via data URL** — bundled `@font-face` URLs
  do not resolve from a temp-file origin, so fonts degrade to system fallback;
  extracting cssText from constructed/cross-origin stylesheets is fragile.
- **`@media print` on the main window** — cannot force Light without mutating
  the live UI when the app is in Dark; hiding app chrome via print CSS is
  brittle against the flex/grid layout.

Approach A is the only option that reliably preserves the app's bundled
typography and async-rendered content (Mermaid/KaTeX) in a forced light theme,
with zero new dependencies.

## Data Flow

```
File menu "Export as PDF…"  ──menu:export-pdf──▶  renderer (main window)
   └─ resolve active tab filePath → window.api.invoke('pdf:export', filePath)
                                         │
                              ┌──────────▼──────────────┐
                              │  main: pdfHandlers       │
                              │ 1. save dialog           │  default = <basename>.pdf, filter pdf
                              │ 2. hidden BrowserWindow   │  show:false, same preload, entry #print?path=<encoded>
                              │ 3. await 'pdf:print-ready' (timeout) │
                              │ 4. printToPDF({printBackground:true}) │
                              │ 5. fs.writeFile(chosen path)          │
                              │ 6. window.destroy()                   │
                              └──────────┬──────────────┘
                       offscreen renderer (#print mode)
                       └─ file:read → existing pipeline render
                          → applyTheme(lightTheme)
                          → all Mermaid settled + document.fonts.ready
                          → window.api.invoke('pdf:print-ready')
```

## Units of Change

| File | Responsibility |
|------|----------------|
| `src/main/ipc/pdfHandlers.ts` (new) | `registerPdfHandlers()` — `pdf:export` handler: save dialog → offscreen window → ready wait → `printToPDF` → write file → cleanup. `derivePdfName(mdPath)` extracted as a pure function. |
| `src/main/menu.ts` | Add `Export as PDF…` to the File submenu (after Save, behind a separator) sending `menu:export-pdf`. |
| `src/main/main.ts` | Register `registerPdfHandlers()`. |
| `src/renderer/index.tsx` | When `location.hash` starts with `#print` (URL form `#print?path=<encoded>`), mount only `<PrintView>` (no App / tab bar / sidebar). |
| `src/renderer/components/PrintView.tsx` (new) | Parse `path` from the hash query (`new URLSearchParams(location.hash.split('?')[1])`) → `file:read` → reuse existing markdown pipeline → `applyTheme(lightTheme)` → after all Mermaid diagrams settle and `document.fonts.ready`, call `pdf:print-ready`. Renders `.markdown-content` only. |
| renderer menu handler | On `menu:export-pdf`: if no active tab, ignore (Welcome screen); else `invoke('pdf:export', filePath)`. |
| `src/shared/types.ts` | Add channels: `'pdf:export': { args: [filePath: string]; return: { ok: true; path: string } \| { ok: false; reason: string } }`, `'pdf:print-ready': { args: []; return: undefined }`. Add `menu:export-pdf` message. |

## Error Handling

Minimal, handled at the nearest meaningful point:

- Save dialog canceled → no-op (normal flow, not an error).
- No active document (Welcome screen) → renderer ignores the menu action.
- `pdf:print-ready` timeout (15s) → destroy offscreen window + `dialog.showErrorBox`.
- `printToPDF` / file write failure → `dialog.showErrorBox` once at the failure
  point + destroy offscreen window.

## Readiness Handshake

The offscreen renderer must not signal ready until async content is settled:

1. Markdown pipeline produces the React tree.
2. All `MermaidDiagram` instances finish rendering (no pending renders).
3. `document.fonts.ready` resolves.
4. Two `requestAnimationFrame` ticks (layout settle).
5. `window.api.invoke('pdf:print-ready')`.

The main process awaits this signal with a 15s timeout.

## Testing

- **Unit (Vitest)**: `derivePdfName` — `/x/foo.md` → `foo.pdf`, `.markdown` →
  `.pdf`, no-extension input; ready-signal timeout logic.
- **e2e (Playwright)**: open a sample `.md`, trigger File > Export as PDF with
  the save path stubbed to a temp location, assert the resulting PDF file
  exists and is non-empty.

## Out of Scope (YAGNI)

Page size / margin options, headers & footers, multi-tab batch export,
progress UI.
