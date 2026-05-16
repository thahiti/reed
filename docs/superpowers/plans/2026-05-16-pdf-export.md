# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a File-menu "Export as PDF…" action that saves the active tab's rendered markdown to a PDF in a forced light theme.

**Architecture:** A hidden `BrowserWindow` boots the same renderer entry in a `#print` mode that re-renders only the markdown content through the existing pipeline with `lightTheme` forced. Once async content (Mermaid, fonts) settles it signals the main process via `pdf:print-ready`; the main process then calls `webContents.printToPDF()` and writes the buffer to a user-chosen path.

**Tech Stack:** Electron 33, React 19, TypeScript (strict), Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-16-pdf-export-design.md`

**Design note:** `printToPDF` uses fixed `pageSize: 'A4'` and `printBackground: true`. A4 is a sensible fixed default for the user base; it is not exposed as an option (stays within the spec's "no page options" scope).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/main/ipc/pdfName.ts` (new) | Pure `derivePdfName(mdPath)` → `<stem>.pdf` |
| `src/main/ipc/pdfHandlers.ts` (new) | `registerPdfHandlers()` — `pdf:export` + `pdf:print-ready` IPC |
| `src/main/main.ts` (modify) | Register the PDF handlers |
| `src/main/menu.ts` (modify) | Add `Export as PDF…` File-menu item |
| `src/shared/types.ts` (modify) | Add `pdf:export` / `pdf:print-ready` channel types |
| `src/renderer/components/mermaidSettled.ts` (new) | Pure `allMermaidSettled(root)` DOM predicate |
| `src/renderer/components/PrintView.tsx` (new) | `#print`-mode component: read file, render content, force light theme, signal ready |
| `src/renderer/index.tsx` (modify) | Branch to `<PrintView />` when hash starts with `#print` |
| `src/renderer/App.tsx` (modify) | Handle `menu:export-pdf` → invoke `pdf:export` |
| `tests/main/pdfName.test.ts` (new) | Unit tests for `derivePdfName` |
| `tests/renderer/mermaidSettled.test.ts` (new) | Unit tests for `allMermaidSettled` |
| `tests/e2e/pdfExport.spec.ts` (new) | e2e: menu → PDF file created |

---

## Task 1: `derivePdfName` pure util

**Files:**
- Create: `src/main/ipc/pdfName.ts`
- Test: `tests/main/pdfName.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/pdfName.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { derivePdfName } from '../../src/main/ipc/pdfName';

describe('derivePdfName', () => {
  it('replaces .md with .pdf', () => {
    expect(derivePdfName('/a/b/foo.md')).toBe('foo.pdf');
  });

  it('replaces .markdown with .pdf', () => {
    expect(derivePdfName('/a/b.markdown')).toBe('b.pdf');
  });

  it('appends .pdf when there is no extension', () => {
    expect(derivePdfName('/a/noext')).toBe('noext.pdf');
  });

  it('handles a bare filename', () => {
    expect(derivePdfName('foo.md')).toBe('foo.pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project main tests/main/pdfName.test.ts`
Expected: FAIL — cannot resolve `../../src/main/ipc/pdfName`.

- [ ] **Step 3: Write minimal implementation**

Create `src/main/ipc/pdfName.ts`:

```ts
import { basename, extname } from 'node:path';

export const derivePdfName = (mdPath: string): string => {
  const base = basename(mdPath);
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  return `${stem}.pdf`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project main tests/main/pdfName.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/pdfName.ts tests/main/pdfName.test.ts
git commit -m "feat(pdf): add derivePdfName util"
```

---

## Task 2: IPC channel types

**Files:**
- Modify: `src/shared/types.ts:22` (add two channels at the end of `IpcChannels`)

- [ ] **Step 1: Add the channel types**

In `src/shared/types.ts`, inside the `IpcChannels` type, after the line
`  'settings:open-file': { args: readonly []; return: undefined };`
add:

```ts
  'pdf:export': {
    args: readonly [filePath: string];
    return: { ok: true; path: string } | { ok: false; reason: string };
  };
  'pdf:print-ready': { args: readonly []; return: undefined };
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm build`
Expected: build succeeds with no type errors (electron-vite type-checks main + renderer). Do NOT use `tsc -p tsconfig.*.json --noEmit` — those configs use include patterns and standalone runs surface unrelated pre-existing TS6307 noise.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(pdf): add pdf:export and pdf:print-ready IPC channel types"
```

---

## Task 3: `pdfHandlers` main-process handler

**Files:**
- Create: `src/main/ipc/pdfHandlers.ts`
- Modify: `src/main/main.ts:3-8` (import) and `src/main/main.ts:60-65` (registration)

> No unit test: this is an Electron integration unit covered by the Task 8 e2e. The pure logic (`derivePdfName`) is already tested in Task 1.
>
> **Spec deviation (intentional):** the spec listed a "ready-signal timeout logic" unit test. The timeout here is a standard `Promise` + `setTimeout` race embedded in the handler closure. Extracting it into a separately testable unit would add an abstraction with a single caller, which the project's CLAUDE.md explicitly discourages (minimal code, Rule of Three, "발생하지 않는 에러를 방어하지 말 것"). CLAUDE.md takes precedence over the spec. The timeout *failure* path is left to code review; the readiness *predicate* (the real logic) is unit-tested in Task 4 and the happy path by the Task 8 e2e.

- [ ] **Step 1: Create the handler**

Create `src/main/ipc/pdfHandlers.ts`:

```ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { derivePdfName } from './pdfName';

const PRINT_READY_TIMEOUT_MS = 15_000;

let resolvePrintReady: (() => void) | null = null;

const createPrintWindow = (): BrowserWindow =>
  new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

const loadPrintEntry = async (
  win: BrowserWindow,
  filePath: string,
): Promise<void> => {
  const hash = `print?path=${encodeURIComponent(filePath)}`;
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    await win.loadURL(`${devUrl}#${hash}`);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }
};

export const registerPdfHandlers = (): void => {
  ipcMain.handle('pdf:print-ready', () => {
    resolvePrintReady?.();
  });

  ipcMain.handle('pdf:export', async (_event, filePath: string) => {
    const focused = BrowserWindow.getFocusedWindow();
    const options = {
      defaultPath: join(dirname(filePath), derivePdfName(filePath)),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    };
    const result = focused
      ? await dialog.showSaveDialog(focused, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { ok: false as const, reason: 'canceled' };
    }
    const target = result.filePath;

    const printWin = createPrintWindow();
    const ready = new Promise<void>((resolve, reject) => {
      resolvePrintReady = resolve;
      setTimeout(
        () => { reject(new Error('PDF render timed out')); },
        PRINT_READY_TIMEOUT_MS,
      );
    });

    try {
      await loadPrintEntry(printWin, filePath);
      await ready;
      const pdf = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await writeFile(target, pdf);
      return { ok: true as const, path: target };
    } catch (err) {
      dialog.showErrorBox(
        'PDF Export Failed',
        err instanceof Error ? err.message : String(err),
      );
      return { ok: false as const, reason: 'failed' };
    } finally {
      resolvePrintReady = null;
      if (!printWin.isDestroyed()) printWin.destroy();
    }
  });
};
```

- [ ] **Step 2: Register in main.ts**

In `src/main/main.ts`, after line 8
(`import { registerDialogHandlers } from './ipc/dialogHandlers';`) add:

```ts
import { registerPdfHandlers } from './ipc/pdfHandlers';
```

In the `app.whenReady().then(() => {` block, after line 64
(`registerDialogHandlers();`) add:

```ts
  registerPdfHandlers();
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm build`
Expected: build succeeds with no type errors (electron-vite type-checks). Do NOT use `tsc -p tsconfig.node.json --noEmit` (unreliable here).

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/pdfHandlers.ts src/main/main.ts
git commit -m "feat(pdf): add pdf:export handler with offscreen printToPDF"
```

---

## Task 4: `allMermaidSettled` readiness predicate

**Files:**
- Create: `src/renderer/components/mermaidSettled.ts`
- Test: `tests/renderer/mermaidSettled.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/mermaidSettled.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allMermaidSettled } from '../../src/renderer/components/mermaidSettled';

const html = (markup: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
};

describe('allMermaidSettled', () => {
  it('is true when there are no mermaid diagrams', () => {
    expect(allMermaidSettled(html('<p>hello</p>'))).toBe(true);
  });

  it('is true when every diagram contains an svg', () => {
    expect(
      allMermaidSettled(
        html('<div data-testid="mermaid-diagram"><svg></svg></div>'),
      ),
    ).toBe(true);
  });

  it('is false when a diagram has no svg yet', () => {
    expect(
      allMermaidSettled(
        html('<div data-testid="mermaid-diagram"></div>'),
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project renderer tests/renderer/mermaidSettled.test.ts`
Expected: FAIL — cannot resolve `mermaidSettled`.

- [ ] **Step 3: Write minimal implementation**

Create `src/renderer/components/mermaidSettled.ts`:

```ts
export const allMermaidSettled = (root: ParentNode): boolean => {
  const diagrams = Array.from(
    root.querySelectorAll('[data-testid="mermaid-diagram"]'),
  );
  return diagrams.every((d) => d.querySelector('svg') !== null);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project renderer tests/renderer/mermaidSettled.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/mermaidSettled.ts tests/renderer/mermaidSettled.test.ts
git commit -m "feat(pdf): add allMermaidSettled readiness predicate"
```

---

## Task 5: `PrintView` component

**Files:**
- Create: `src/renderer/components/PrintView.tsx`

> No unit test: this component depends on `window.api` IPC and the full
> markdown pipeline; it is exercised by the Task 8 e2e. Its only
> non-trivial pure piece (`allMermaidSettled`) is tested in Task 4.

- [ ] **Step 1: Create the component**

Create `src/renderer/components/PrintView.tsx`:

```tsx
import { useEffect, useState, type ReactElement } from 'react';
import { processMarkdown } from '../pipeline/createProcessor';
import { applyTheme } from '../themes/applyTheme';
import { lightTheme } from '../themes/light';
import { allMermaidSettled } from './mermaidSettled';

const getPathParam = (): string => {
  const { hash } = window.location;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('path') ?? '';
};

export const PrintView = (): ReactElement => {
  const [rendered, setRendered] = useState<ReactElement | null>(null);

  useEffect(() => {
    applyTheme(lightTheme);
    const path = getPathParam();
    void window.api
      .invoke('file:read', path)
      .then((content) => {
        setRendered(processMarkdown(content, path).rendered);
      });
  }, []);

  useEffect(() => {
    if (!rendered) return undefined;
    let cancelled = false;
    const tick = (): void => {
      if (cancelled) return;
      if (allMermaidSettled(document.body)) {
        void document.fonts.ready.then(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              void window.api.invoke('pdf:print-ready');
            });
          });
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [rendered]);

  return <div className="markdown-content">{rendered}</div>;
};
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm build`
Expected: build succeeds with no type errors (electron-vite type-checks). Do NOT use `tsc -p tsconfig.web.json --noEmit` (unreliable here).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/PrintView.tsx
git commit -m "feat(pdf): add PrintView render component for #print mode"
```

---

## Task 6: Renderer entry branch

**Files:**
- Modify: `src/renderer/index.tsx:11-17`

- [ ] **Step 1: Branch on the hash**

Replace lines 11-17 of `src/renderer/index.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
```

with:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PrintView } from './components/PrintView';

const root = document.getElementById('root');
if (root) {
  const isPrint = window.location.hash.startsWith('#print');
  createRoot(root).render(isPrint ? <PrintView /> : <App />);
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm build`
Expected: build succeeds with no type errors (electron-vite type-checks). Do NOT use `tsc -p tsconfig.web.json --noEmit` (unreliable here).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.tsx
git commit -m "feat(pdf): mount PrintView when hash starts with #print"
```

---

## Task 7: Menu item + renderer trigger

**Files:**
- Modify: `src/main/menu.ts:165-166` (File submenu, after the Save item's separator)
- Modify: `src/renderer/App.tsx:418` (add an effect after the `menu:save` effect)

- [ ] **Step 1: Add the menu item**

In `src/main/menu.ts`, the File submenu currently has, after the Save item:

```ts
        { type: 'separator' },
        {
          label: 'Copy File Path',
```

Insert a new item and separator between the Save block's `{ type: 'separator' }` (line 166) and the `Copy File Path` item:

```ts
        { type: 'separator' },
        {
          label: 'Export as PDF...',
          click: () => { mainWindow.webContents.send('menu:export-pdf'); },
        },
        { type: 'separator' },
        {
          label: 'Copy File Path',
```

(Net effect: a new `Export as PDF...` item with its own separator sits between Save and Copy File Path.)

- [ ] **Step 2: Add the renderer handler**

In `src/renderer/App.tsx`, immediately after the `menu:save` effect that ends at line 418 (`  }, [handleSave]);`), add:

```tsx
  // Menu — export as PDF
  useEffect(() => {
    const unsub = window.api.on('menu:export-pdf', () => {
      if (activeTab?.filePath) {
        void window.api.invoke('pdf:export', activeTab.filePath);
      }
    });
    return unsub;
  }, [activeTab]);
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm build`
Expected: build succeeds with no type errors (electron-vite type-checks main + renderer). Do NOT use `tsc -p tsconfig.*.json --noEmit` — those configs use include patterns and standalone runs surface unrelated pre-existing TS6307 noise.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/menu.ts src/renderer/App.tsx
git commit -m "feat(pdf): add Export as PDF menu item and renderer trigger"
```

---

## Task 8: e2e test

**Files:**
- Create: `tests/e2e/pdfExport.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `tests/e2e/pdfExport.spec.ts`:

```ts
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('PDF export E2E', () => {
  test('exports the active tab to a PDF file', async () => {
    const mdFile = resolve(__dirname, '../../test-fixture-pdf.md');
    const outPdf = resolve(tmpdir(), `reed-export-${String(Date.now())}.pdf`);
    writeFileSync(mdFile, '# PDF Title\n\nHello **world**.\n');

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ dialog }, filePath) => {
        // Stub the save dialog to a fixed temp path.
        dialog.showSaveDialog = (async () => ({
          canceled: false,
          filePath,
        })) as typeof dialog.showSaveDialog;
      }, outPdf);

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, mdFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('menu:export-pdf');
      });

      await expect
        .poll(() => existsSync(outPdf), { timeout: 20000 })
        .toBe(true);
      expect(statSync(outPdf).size).toBeGreaterThan(0);

      await app.close();
    } finally {
      try { unlinkSync(mdFile); } catch { /* */ }
      try { unlinkSync(outPdf); } catch { /* */ }
    }
  });
});
```

- [ ] **Step 2: Build the app**

Run: `pnpm build`
Expected: build succeeds (produces `out/main/main.js`).

- [ ] **Step 3: Run the e2e test**

Run: `pnpm exec playwright test --config=tests/e2e/playwright.config.ts pdfExport`
Expected: PASS (1 test) — `outPdf` exists and is non-empty.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/pdfExport.spec.ts
git commit -m "test(pdf): add e2e test for PDF export"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 2: Lint the whole project**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Run the full e2e suite**

Run: `pnpm build && pnpm test:e2e`
Expected: all e2e tests pass (no regression).

- [ ] **Step 4: Build the app bundle**

Run: `pnpm run build:app`
Expected: build succeeds.

- [ ] **Step 5: Manual smoke check**

Launch the built app, open a `.md` file (including one with a Mermaid
diagram and one with KaTeX), File → Export as PDF…, choose a path, and
confirm the PDF opens with light-theme styling, correct fonts, and rendered
diagrams/math.
