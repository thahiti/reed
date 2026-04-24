# Internal Markdown Link Navigation — Design

**Date:** 2026-04-24
**Status:** Draft
**Target branch:** `feat/md-link-navigation`

## Problem

Markdown documents often cross-reference each other with relative-path links such as `[아키텍처 개요](docs/01-architecture-overview.md)` or `[API 섹션](docs/design.md#api)`. Reed currently renders these as anchors but calling `preventDefault()` without any follow-up, so the click is silently ignored. Users cannot follow internal document links, breaking a core documentation-reading workflow.

The `Link` component already accepts an `onOpenFile` prop, but `createProcessor.ts` never passes it in, and the path is never resolved against the current document's directory. The plumbing is half-built and disconnected.

## Goals

- Clicking a relative `.md`/`.markdown` link navigates the current tab to the target document, with browser-like back/forward history per tab. (Edit mode uses CodeMirror, which renders raw markdown — `Link` components only exist in read mode by construction.)
- Anchor links inside the target (`foo.md#section`) scroll to that heading after load.
- Back/forward restore the previous scroll position.
- Missing target files give an immediate local visual cue without interrupting the reading flow.
- Tabs with unsaved modifications block all navigation to prevent accidental data loss.

## Non-Goals

- Opening `.md` links in a new tab (e.g. ⌘+click). Deferred until real demand emerges.
- Opening non-markdown linked files (images, PDFs, `.txt`) with the OS default app. Deferred.
- Cross-tab history or a global navigation stack. History is strictly per-tab.
- Toast / banner notification infrastructure. Out of scope; failures use local flash only.

## Behavior Specification

| Situation | Behavior |
|-----------|----------|
| Click relative `.md`/`.markdown` link | Replace current tab's content with the target; push previous state onto the tab's history stack. |
| Link has an anchor (`docs/file.md#intro`) | Load file, then scroll to the element with `id="intro"`. |
| Target is already open in another tab | Still navigate in the current tab. Duplicate entries across tabs are allowed. |
| Link points to a non-existent file | Link flashes red (200 ms), no navigation occurs, `console.warn` logs the path. |
| Active tab has `modified === true` — link click | Same flash-red feedback as a missing file; navigation blocked. |
| Active tab has `modified === true` — Ctrl+[ / Ctrl+] | Silent NOOP, `console.warn` only; history unchanged. |
| Edit mode | `Link` components do not render (editor view shows raw markdown), so link clicks are not a concern. Ctrl+[ / Ctrl+] are still blocked while modified. |
| Ctrl+[ | Navigate back in the current tab's history. |
| Ctrl+] | Navigate forward (only possible after a back). |
| Back/forward target | Reload that file's content from disk; restore the saved `topLine` scroll. |
| Navigate after going back | Forward history is truncated; new entry is pushed (standard browser semantics). |
| Back/forward target no longer exists on disk | Silent NOOP — `console.warn` only; history is not mutated, user can retry. |
| External URL (`http://`, `https://`) | Existing behavior: open with `shell.openExternal` via `file:open-external`. |
| In-page anchor (`#section`) | Existing behavior: browser default scroll (no `preventDefault`). |

## Data Model

```ts
type HistoryEntry = {
  readonly filePath: string;
  readonly topLine: number;      // last known top-visible line in this entry
  readonly anchorId?: string;    // set if entered via an anchor link
};

type Tab = {
  readonly id: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
  readonly modified: boolean;
  // new fields
  readonly history: ReadonlyArray<HistoryEntry>;
  readonly historyIndex: number;
};
```

**Invariants:**

- A tab with a file has `history.length ≥ 1` and `0 ≤ historyIndex < history.length`.
- An "Untitled" tab (`filePath === null`) has `history: []`, `historyIndex: -1`. Navigation is disabled for such tabs.
- Back is enabled iff `historyIndex > 0`.
- Forward is enabled iff `historyIndex < history.length - 1`.

**Update rules:**

- **Scroll tracking:** While the tab is active, `topLineRef` changes update `history[historyIndex].topLine`. Debounced by the same cadence that already drives `topLineRef`.
- **Navigate:** `history := [...history.slice(0, historyIndex + 1), newEntry]`, `historyIndex := history.length - 1`. The previous entry's `topLine` is captured just before this mutation.
- **Back:** Capture current `topLine` into `history[historyIndex]`, then decrement `historyIndex`.
- **Forward:** Capture current `topLine` into `history[historyIndex]`, then increment `historyIndex`.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer                                                     │
│                                                              │
│  Link.tsx                                                    │
│    Branches on href: external | anchor | relative file       │
│    - External → existing file:open-external                  │
│    - Anchor (#x) → pass through to browser default           │
│    - Relative → call onNavigate(href); render flash on fail  │
│                                                              │
│  createProcessor.ts                                          │
│    Passes { onNavigate, basePath } to Link                   │
│                                                              │
│  useTabs.ts                                                  │
│    openTab:        seeds a one-entry history for new tabs    │
│    navigateTab:    pushes entry, truncates forward history   │
│    goBack/goForward: returns target entry, app reads disk    │
│    updateCurrentTopLine: keeps current entry's topLine fresh │
│                                                              │
│  App.tsx                                                     │
│    handleNavigate(href):                                     │
│      if activeTab.modified → signal Link to flash; return    │
│      split href → { relPath, anchorId }                      │
│      invoke file:read-relative(basePath, relPath)            │
│      on success → navigateTab(...)                           │
│      on null    → signal Link to flash                       │
│    Registers Ctrl+[ / Ctrl+] handlers                        │
│      if activeTab.modified → NOOP + console.warn             │
│                                                              │
│  MarkdownView                                                │
│    Accepts initialAnchorId prop; after render,               │
│    scrolls element by id into view if provided               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Main                                                         │
│                                                              │
│  fileHandlers.ts                                             │
│    file:read-relative(basePath, relPath)                     │
│      → resolved = path.resolve(path.dirname(basePath), rel)  │
│      → on stat/read failure → null                           │
│      → on success → { absolutePath, content }                │
└──────────────────────────────────────────────────────────────┘
```

### Why resolve in main, not renderer

- Node's `path.resolve` is canonical and cross-platform safe.
- Resolve + existence check + read are bundled in a single IPC round-trip, avoiding TOCTOU races.
- Keeps the renderer free of path-manipulation logic.

### Why a new `onNavigate` prop instead of reusing `onOpenFile`

- `onOpenFile` means "open a document" (new tab, or focus existing) — the semantics of `openTab`.
- `onNavigate` means "move within the current tab" — the semantics of `navigateTab`.
- Keeping them separate allows future ⌘+click-opens-new-tab to slot in cleanly without conditionals.

### Anchor handling

- `href = "docs/foo.md#heading-id"` splits into `relPath = "docs/foo.md"` and `anchorId = "heading-id"`.
- `anchorId` is stored on the new `HistoryEntry` and forwarded to `MarkdownView` via `initialAnchorId`.
- On mount/update the view does `document.getElementById(anchorId)?.scrollIntoView({ block: 'start' })` inside the scroll container.
- If no anchor, the view falls back to `initialLine = entry.topLine`.
- Pure in-page anchors (`#foo` with no file part) keep today's browser-default behavior.

## Key Data Flow Scenarios

### Click relative link with anchor

```
Link.onClick
  preventDefault; onNavigate("docs/design.md#api")
App.handleNavigate
  activeTab.modified? → flash + return
  split → { relPath: "docs/design.md", anchorId: "api" }
  IPC file:read-relative("/repo/README.md", "docs/design.md")
  result { absolutePath: "/repo/docs/design.md", content }
  navigateTab(activeTabId, { filePath, fileName: "design.md", content, anchorId })
useTabs.navigateTab
  patch history[historyIndex].topLine ← current topLineRef.current
  history := [...slice(0, historyIndex+1), { filePath, topLine: 1, anchorId: "api" }]
  historyIndex += 1
  tab.filePath/fileName/content replaced
MarkdownView
  rerender with new content
  after render: scroll getElementById("api")
```

### Back (Ctrl+[)

```
App keybinding match
  if activeTab.modified → console.warn; return
  → goBack(activeTabId)
useTabs.goBack
  if historyIndex === 0 → NOOP
  patch history[historyIndex].topLine ← current topLineRef.current
  prev := history[historyIndex - 1]
  historyIndex -= 1
  returns { filePath: prev.filePath, topLine: prev.topLine, anchorId: prev.anchorId }
App
  invoke file:read-relative(prev.filePath, "")  // re-read from disk
  on null → console.warn, NOOP (history is NOT reverted)
  on success → patch tab content/filePath/fileName, apply initialLine or anchor scroll
```

### Missing file flash

```
App.handleNavigate
  IPC returns null
  setFlashTarget(href) — transient state keyed by href
Link (matching href) sees flashError=true for 200 ms, renders red border
  then state clears
```

## Keybindings

Add two entries to the keybinding defaults (`src/shared/keybindings.ts`):

| Action id | Default |
|-----------|---------|
| `nav:back` | `Ctrl+[` |
| `nav:forward` | `Ctrl+]` |

Both are customizable via settings, consistent with other app shortcuts. No menu items are added (keyboard-first, matching the existing vim-style navigation design).

## Error Handling

| Failure | Response |
|---------|----------|
| Relative target file missing at click time | Flash red on link, no navigation, `console.warn` |
| Active tab has unsaved modifications (click) | Flash red on link, no navigation — user must save or discard first |
| Active tab has unsaved modifications (Ctrl+[/]) | Silent NOOP, `console.warn` |
| Back/forward target deleted from disk | Silent NOOP, `console.warn`, history stays as-is so retry works after restore |
| Malformed link href (non-string, empty) | Treat as inert, do nothing |
| Anchor id not present in loaded document | Fall back to `topLine = 1` (scroll to top) |

Edge cases intentionally not handled by dialogs; this is a viewer, and reader flow beats exhaustive error reporting.

## Testing Strategy

### Unit

**`tests/renderer/hooks/useTabs.test.ts`**

- New tab initializes with a single-entry history and `historyIndex = 0`.
- `navigateTab` pushes an entry, increments `historyIndex`, and captures previous `topLine`.
- Calling `navigateTab` after a back truncates forward history.
- `goBack` decrements, returns target entry, captures current `topLine`.
- `goBack` at `historyIndex === 0` is a NOOP.
- `goForward` is symmetric.
- `updateCurrentTopLine` mutates only the current entry.
- Untitled tab: `navigateTab`/`goBack`/`goForward` are all NOOP.

**`tests/renderer/components/Link.test.tsx`** (new)

- External URL → calls `file:open-external` IPC.
- `#anchor` → no `preventDefault`, no `onNavigate` call.
- Relative `.md` → `onNavigate(href)` invoked.
- `flashError` prop transitions toggle the error class for 200 ms then clear.

**`tests/main/ipc/fileHandlers.test.ts`** (extend)

- `file:read-relative` returns `{ absolutePath, content }` for an existing relative path.
- Returns `null` for a missing path.
- Resolves `..` segments correctly.
- Uses `path.dirname(basePath)` as the anchor directory.

### E2E (`tests/e2e/linkNavigation.spec.ts`, new)

- Open file A → click relative link to B → tab count unchanged, content replaced, title updated.
- Open file A → click `B.md#heading` → document B loaded + scroll position matches `#heading`.
- After navigating A → B, press Ctrl+[ → back at A with its prior scroll position.
- Ctrl+[ then Ctrl+] → forward to B at its prior scroll position.
- After going back, clicking a new link drops forward history (Ctrl+] becomes NOOP).
- Click link to non-existent file → link flashes red, no tab change, no content change.
- Modify current tab in edit mode → return to read mode → click link: flashes red, no navigation.
- Modified tab + Ctrl+[ → no tab change.

## Implementation Order

Each step is a single TDD loop and a single atomic commit.

1. **types**: extend `HistoryEntry`, `Tab.history`, `Tab.historyIndex`; update shared type tests.
2. **useTabs – history init**: `openTab` seeds a one-entry history. Test.
3. **useTabs – `navigateTab`**: push + forward-truncate semantics. Test.
4. **useTabs – `goBack` / `goForward` / `updateCurrentTopLine`**. Test.
5. **IPC – `file:read-relative`**: main handler + preload exposure. Test.
6. **keybindings**: register `nav:back` / `nav:forward` defaults. Test.
7. **Link component**: add `onNavigate`, `flashError`. Test.
8. **createProcessor wiring**: pass `onNavigate`, `basePath` to Link.
9. **App.handleNavigate**: modified guard + href split + IPC call + `navigateTab`.
10. **App back/forward**: modified guard + keybinding handlers + `topLine` sync.
11. **Anchor scrolling**: `MarkdownView.initialAnchorId` prop + post-render scroll.
12. **E2E tests**.

Each step ends with `pnpm test` green, `pnpm lint` 0 errors, and a conventional commit. Step 12 is followed by `pnpm build` verification.

## Open Questions

None outstanding. All design decisions are captured above.
