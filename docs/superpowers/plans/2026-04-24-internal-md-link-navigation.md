# Internal Markdown Link Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable clicking relative `.md`/`.markdown` links to navigate within the current tab, with browser-style back/forward history per tab, anchor scroll support, and a modified-tab guard to prevent data loss.

**Architecture:** Extend `Tab` with a per-tab navigation history stack. `Link` components read navigation state via a new `NavigationContext` provided by `App`. On click, `App.handleNavigate` resolves the path via the existing `file:resolve-path` IPC, reads content via `file:read`, then commits a new history entry through `useTabs.navigateTab`. `Ctrl+[`/`Ctrl+]` trigger back/forward. `MarkdownView` receives `initialAnchorId` and remounts on history-index change (via React `key`) to apply scroll restoration.

**Tech Stack:** React 18 + TypeScript (renderer), Electron 33 (main), Vitest (unit), Playwright (E2E), rehype-react for markdown rendering.

**Spec:** `docs/superpowers/specs/2026-04-24-internal-md-link-navigation-design.md`

---

## File Structure

**Create:**
- `src/renderer/contexts/NavigationContext.ts` — React context for `onNavigate` and `flashTargetHref`
- `tests/renderer/components/Link.test.tsx` — Link component tests (uses jsdom + RTL)
- `tests/e2e/linkNavigation.spec.ts` — Playwright E2E test

**Modify:**
- `src/shared/types.ts` — add `NavHistoryEntry`, extend `Tab`
- `src/shared/keybindings.ts` — add `nav:back`, `nav:forward` actions
- `src/renderer/hooks/useTabs.ts` — seed history, add `navigateTab`/`peekBack`/`peekForward`/`commitNavigateToIndex`
- `src/renderer/components/markdown/Link.tsx` — consume `NavigationContext`, add flash
- `src/renderer/components/MarkdownView.tsx` — add `initialAnchorId` prop
- `src/renderer/App.tsx` — provide context, add handlers, register keybindings, add key on MarkdownView
- `src/renderer/styles/*.css` (existing) — add `.link.link-flash` error style
- `tests/renderer/hooks/useTabs.test.ts` — add history-related tests

**No changes needed in:**
- `src/main/ipc/fileHandlers.ts` — `file:resolve-path` and `file:read` are reused as-is
- `src/preload/preload.ts` — no new IPC channels
- `src/renderer/pipeline/createProcessor.ts` — Link reads from context; processor stays pure

---

## Task 1: Extend shared types with navigation history

**Files:**
- Modify: `src/shared/types.ts`
- Test: `tests/shared/types.test.ts`

- [ ] **Step 1: Add failing type-level test**

Add at the end of `tests/shared/types.test.ts`:

```ts
describe('NavHistoryEntry and Tab.history', () => {
  it('allows a Tab with a history stack', () => {
    const tab: Tab = {
      id: 'tab-1',
      filePath: '/a.md',
      fileName: 'a.md',
      content: '',
      modified: false,
      history: [{ filePath: '/a.md', topLine: 1 }],
      historyIndex: 0,
    };
    expect(tab.history[0]?.filePath).toBe('/a.md');
  });

  it('allows an anchorId on history entries', () => {
    const entry: NavHistoryEntry = { filePath: '/a.md', topLine: 10, anchorId: 'intro' };
    expect(entry.anchorId).toBe('intro');
  });
});
```

At the top of the file, ensure `NavHistoryEntry` is imported from `'../../src/shared/types'` alongside `Tab`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/shared/types.test.ts`
Expected: FAIL with `Module '"../../src/shared/types"' has no exported member 'NavHistoryEntry'` or a TS error about `history`/`historyIndex` missing on `Tab`.

- [ ] **Step 3: Add the types**

In `src/shared/types.ts`, add after the existing `HistoryEntry` type (around line 28):

```ts
export type NavHistoryEntry = {
  readonly filePath: string;
  readonly topLine: number;
  readonly anchorId?: string;
};
```

Extend the existing `Tab` type:

```ts
export type Tab = {
  readonly id: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
  readonly modified: boolean;
  readonly history: ReadonlyArray<NavHistoryEntry>;
  readonly historyIndex: number;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- --run tests/shared/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full unit test suite to surface breakage**

Run: `pnpm test -- --run`
Expected: FAIL — existing call sites that construct `Tab` objects (e.g. in `useTabs.ts`) don't provide `history`/`historyIndex` yet. Record the failures; they'll be fixed in Task 2.

If the only failures trace to missing `history`/`historyIndex` properties, proceed. If there are unrelated errors, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git commit -m "$(cat <<'EOF'
feat(types): add NavHistoryEntry and extend Tab with history stack

Adds per-tab navigation history fields in preparation for internal
markdown link navigation with back/forward support.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Seed history on tab creation in useTabs

**Files:**
- Modify: `src/renderer/hooks/useTabs.ts`
- Test: `tests/renderer/hooks/useTabs.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/hooks/useTabs.test.ts` at the end of the `describe('useTabs', ...)` block:

```ts
it('seeds a one-entry history on openTab', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.openTab('/path/a.md', 'a.md', '# A');
  });
  const tab = result.current.tabs[0];
  expect(tab?.history).toEqual([{ filePath: '/path/a.md', topLine: 1 }]);
  expect(tab?.historyIndex).toBe(0);
});

it('creates untitled tab with empty history', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.createNewTab();
  });
  const tab = result.current.tabs[0];
  expect(tab?.history).toEqual([]);
  expect(tab?.historyIndex).toBe(-1);
});

it('seeds history when promoting an untitled tab', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.createNewTab();
  });
  const tabId = result.current.tabs[0]?.id;
  if (!tabId) throw new Error('tab not found');
  act(() => {
    result.current.promoteTab(tabId, '/path/new.md', 'new.md');
  });
  expect(result.current.tabs[0]?.history).toEqual([{ filePath: '/path/new.md', topLine: 1 }]);
  expect(result.current.tabs[0]?.historyIndex).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: FAIL — new tabs are created without `history`/`historyIndex`.

- [ ] **Step 3: Update `openTab` to seed history**

In `src/renderer/hooks/useTabs.ts`, replace the `openTab` callback:

```ts
const openTab = useCallback((filePath: string, fileName: string, content: string) => {
  setTabs((prev) => {
    const existing = prev.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return prev;
    }
    const newTab: Tab = {
      id: generateId(),
      filePath,
      fileName,
      content,
      modified: false,
      history: [{ filePath, topLine: 1 }],
      historyIndex: 0,
    };
    setActiveTabId(newTab.id);
    return [...prev, newTab];
  });
}, []);
```

- [ ] **Step 4: Update `createNewTab` to use empty history**

Replace the `createNewTab` callback:

```ts
const createNewTab = useCallback(() => {
  setTabs((prev) => {
    const existing = prev.find((t) => t.filePath === null);
    if (existing) {
      setActiveTabId(existing.id);
      return prev;
    }
    const newTab: Tab = {
      id: generateId(),
      filePath: null,
      fileName: 'Untitled',
      content: '',
      modified: false,
      history: [],
      historyIndex: -1,
    };
    setActiveTabId(newTab.id);
    return [...prev, newTab];
  });
}, []);
```

- [ ] **Step 5: Update `promoteTab` to seed history**

Replace the `promoteTab` callback:

```ts
const promoteTab = useCallback((tabId: string, filePath: string, fileName: string) => {
  setTabs((prev) =>
    prev.map((t) =>
      t.id === tabId
        ? {
            ...t,
            filePath,
            fileName,
            modified: false,
            history: [{ filePath, topLine: 1 }],
            historyIndex: 0,
          }
        : t,
    ),
  );
}, []);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: PASS (all tests, including the new ones).

- [ ] **Step 7: Run the full unit test suite**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 8: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/hooks/useTabs.ts tests/renderer/hooks/useTabs.test.ts
git commit -m "$(cat <<'EOF'
feat(tabs): seed navigation history on tab creation

openTab and promoteTab seed a one-entry history stack; createNewTab
leaves history empty for untitled tabs which cannot resolve relative
links.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `navigateTab` to useTabs

**Files:**
- Modify: `src/renderer/hooks/useTabs.ts`
- Test: `tests/renderer/hooks/useTabs.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/renderer/hooks/useTabs.test.ts`:

```ts
describe('useTabs.navigateTab', () => {
  it('pushes a new history entry and advances historyIndex', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/a.md', 'a.md', '# A');
    });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.navigateTab(tabId,
        { filePath: '/b.md', fileName: 'b.md', content: '# B' },
        10,
      );
    });
    const tab = result.current.tabs[0];
    expect(tab?.filePath).toBe('/b.md');
    expect(tab?.fileName).toBe('b.md');
    expect(tab?.content).toBe('# B');
    expect(tab?.history.length).toBe(2);
    expect(tab?.history[0]).toEqual({ filePath: '/a.md', topLine: 10 });
    expect(tab?.history[1]).toEqual({ filePath: '/b.md', topLine: 1 });
    expect(tab?.historyIndex).toBe(1);
  });

  it('carries anchorId into the new history entry', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.navigateTab(tabId,
        { filePath: '/b.md', fileName: 'b.md', content: '# B', anchorId: 'intro' },
        0,
      );
    });
    expect(result.current.tabs[0]?.history[1]?.anchorId).toBe('intro');
  });

  it('appends history linearly across multiple navigates', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.navigateTab(tabId, { filePath: '/b.md', fileName: 'b.md', content: '# B' }, 0);
      result.current.navigateTab(tabId, { filePath: '/c.md', fileName: 'c.md', content: '# C' }, 0);
      result.current.navigateTab(tabId, { filePath: '/d.md', fileName: 'd.md', content: '# D' }, 0);
    });
    expect(result.current.tabs[0]?.history.length).toBe(4);
    expect(result.current.tabs[0]?.historyIndex).toBe(3);
  });

  it('is a NOOP for untitled tabs', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.createNewTab(); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.navigateTab(tabId,
        { filePath: '/b.md', fileName: 'b.md', content: '# B' },
        0,
      );
    });
    // Untitled tab unchanged
    expect(result.current.tabs[0]?.filePath).toBeNull();
    expect(result.current.tabs[0]?.history).toEqual([]);
    expect(result.current.tabs[0]?.historyIndex).toBe(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: FAIL — `navigateTab is not a function`.

- [ ] **Step 3: Implement `navigateTab`**

In `src/renderer/hooks/useTabs.ts`, add after the existing `promoteTab` callback (before the `activeTab` const):

```ts
const navigateTab = useCallback(
  (
    tabId: string,
    next: {
      readonly filePath: string;
      readonly fileName: string;
      readonly content: string;
      readonly anchorId?: string;
    },
    currentTopLine: number,
  ) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== tabId) return t;
        if (t.historyIndex < 0) return t; // untitled tab guard
        const retained = t.history.slice(0, t.historyIndex + 1).map((entry, idx) =>
          idx === t.historyIndex ? { ...entry, topLine: currentTopLine } : entry,
        );
        const newEntry = { filePath: next.filePath, topLine: 1, anchorId: next.anchorId };
        return {
          ...t,
          filePath: next.filePath,
          fileName: next.fileName,
          content: next.content,
          modified: false,
          history: [...retained, newEntry],
          historyIndex: retained.length,
        };
      }),
    );
  },
  [],
);
```

Add `navigateTab` to the returned object at the bottom:

```ts
return { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab: setActiveTabId, updateTabContent, markTabSaved, reloadTab, forceReloadTab, createNewTab, promoteTab, navigateTab };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useTabs.ts tests/renderer/hooks/useTabs.test.ts
git commit -m "$(cat <<'EOF'
feat(tabs): add navigateTab for in-tab document navigation

navigateTab replaces the active tab's content with a target document and
pushes a new entry onto the tab's history stack, capturing the previous
entry's topLine. Untitled tabs are NOOP guarded.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `peekBack`, `peekForward`, `commitNavigateToIndex` to useTabs

**Files:**
- Modify: `src/renderer/hooks/useTabs.ts`
- Test: `tests/renderer/hooks/useTabs.test.ts`

These pure helpers let App inspect history before doing an async file read; `commitNavigateToIndex` mutates state after the read succeeds.

- [ ] **Step 1: Write failing tests**

Append to `tests/renderer/hooks/useTabs.test.ts`:

```ts
import { peekBack, peekForward } from '../../../src/renderer/hooks/useTabs';

describe('peekBack / peekForward', () => {
  const makeTab = (history: ReadonlyArray<{ filePath: string; topLine: number; anchorId?: string }>, historyIndex: number) => ({
    id: 't1',
    filePath: history[historyIndex]?.filePath ?? null,
    fileName: 'f',
    content: '',
    modified: false,
    history,
    historyIndex,
  });

  it('peekBack returns previous entry when available', () => {
    const tab = makeTab(
      [{ filePath: '/a.md', topLine: 5 }, { filePath: '/b.md', topLine: 0 }],
      1,
    );
    expect(peekBack(tab)).toEqual({ filePath: '/a.md', topLine: 5 });
  });

  it('peekBack returns null at index 0', () => {
    const tab = makeTab([{ filePath: '/a.md', topLine: 0 }], 0);
    expect(peekBack(tab)).toBeNull();
  });

  it('peekBack returns null for untitled tab (historyIndex -1)', () => {
    const tab = makeTab([], -1);
    expect(peekBack(tab)).toBeNull();
  });

  it('peekForward returns next entry when available', () => {
    const tab = makeTab(
      [{ filePath: '/a.md', topLine: 0 }, { filePath: '/b.md', topLine: 0 }],
      0,
    );
    expect(peekForward(tab)).toEqual({ filePath: '/b.md', topLine: 0 });
  });

  it('peekForward returns null at last index', () => {
    const tab = makeTab([{ filePath: '/a.md', topLine: 0 }], 0);
    expect(peekForward(tab)).toBeNull();
  });
});

describe('useTabs.commitNavigateToIndex', () => {
  it('moves historyIndex and replaces content/filePath/fileName', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.navigateTab(tabId,
        { filePath: '/b.md', fileName: 'b.md', content: '# B' },
        12,
      );
    });
    // Now at index 1 pointing to b.md, history[0].topLine=12.
    act(() => {
      result.current.commitNavigateToIndex(tabId, 0, '# A reloaded', 'a.md', 3);
    });
    const tab = result.current.tabs[0];
    expect(tab?.historyIndex).toBe(0);
    expect(tab?.filePath).toBe('/a.md');
    expect(tab?.fileName).toBe('a.md');
    expect(tab?.content).toBe('# A reloaded');
    // The entry we *left* (index 1) retains its topLine=3 update
    expect(tab?.history[1]?.topLine).toBe(3);
    // The target entry (index 0) preserves its stored topLine
    expect(tab?.history[0]?.topLine).toBe(12);
  });

  it('is a NOOP when target index is out of range', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.commitNavigateToIndex(tabId, 5, 'X', 'x.md', 0);
    });
    // Unchanged
    expect(result.current.tabs[0]?.filePath).toBe('/a.md');
    expect(result.current.tabs[0]?.historyIndex).toBe(0);
  });

  it('truncates forward history when navigating after back', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id ?? '';
    act(() => {
      result.current.navigateTab(tabId, { filePath: '/b.md', fileName: 'b.md', content: '# B' }, 0);
      result.current.navigateTab(tabId, { filePath: '/c.md', fileName: 'c.md', content: '# C' }, 0);
    });
    // Go back to b.md (index 1)
    act(() => {
      result.current.commitNavigateToIndex(tabId, 1, '# B', 'b.md', 0);
    });
    // Now navigate to d.md — forward (c.md at index 2) must be dropped
    act(() => {
      result.current.navigateTab(tabId, { filePath: '/d.md', fileName: 'd.md', content: '# D' }, 0);
    });
    expect(result.current.tabs[0]?.history.length).toBe(3);
    expect(result.current.tabs[0]?.historyIndex).toBe(2);
    expect(result.current.tabs[0]?.history[2]?.filePath).toBe('/d.md');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: FAIL — `peekBack`/`peekForward`/`commitNavigateToIndex` undefined.

- [ ] **Step 3: Implement the three helpers**

In `src/renderer/hooks/useTabs.ts`:

Add pure helpers above the hook (below the `generateId` line):

```ts
export const peekBack = (tab: Tab): NavHistoryEntry | null => {
  if (tab.historyIndex <= 0) return null;
  return tab.history[tab.historyIndex - 1] ?? null;
};

export const peekForward = (tab: Tab): NavHistoryEntry | null => {
  if (tab.historyIndex < 0) return null;
  if (tab.historyIndex >= tab.history.length - 1) return null;
  return tab.history[tab.historyIndex + 1] ?? null;
};
```

Import `NavHistoryEntry` alongside `Tab` at the top:

```ts
import type { Tab, NavHistoryEntry } from '../../shared/types';
```

Add the `commitNavigateToIndex` callback in the hook body, near `navigateTab`:

```ts
const commitNavigateToIndex = useCallback(
  (
    tabId: string,
    targetIndex: number,
    content: string,
    fileName: string,
    currentTopLine: number,
  ) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== tabId) return t;
        if (targetIndex < 0 || targetIndex >= t.history.length) return t;
        const target = t.history[targetIndex];
        if (!target) return t;
        const patchedHistory = t.history.map((entry, idx) =>
          idx === t.historyIndex ? { ...entry, topLine: currentTopLine } : entry,
        );
        return {
          ...t,
          filePath: target.filePath,
          fileName,
          content,
          modified: false,
          history: patchedHistory,
          historyIndex: targetIndex,
        };
      }),
    );
  },
  [],
);
```

Add `commitNavigateToIndex` to the returned object:

```ts
return { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab: setActiveTabId, updateTabContent, markTabSaved, reloadTab, forceReloadTab, createNewTab, promoteTab, navigateTab, commitNavigateToIndex };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run tests/renderer/hooks/useTabs.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useTabs.ts tests/renderer/hooks/useTabs.test.ts
git commit -m "$(cat <<'EOF'
feat(tabs): add peekBack/peekForward and commitNavigateToIndex

Pure peekBack/peekForward return the adjacent history entry without
mutating state. commitNavigateToIndex mutates after an async file read
succeeds, keeping history and state consistent. Enables back/forward.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `nav:back` / `nav:forward` keybindings

**Files:**
- Modify: `src/shared/keybindings.ts`
- Test: `tests/shared/keybindings.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/shared/keybindings.test.ts`:

```ts
it('includes nav:back and nav:forward in actions', () => {
  expect(keybindingActions).toContain('nav:back');
  expect(keybindingActions).toContain('nav:forward');
});

it('defaults nav:back to Ctrl+[ and nav:forward to Ctrl+]', () => {
  expect(defaultKeybindings['nav:back']).toBe('Ctrl+[');
  expect(defaultKeybindings['nav:forward']).toBe('Ctrl+]');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --run tests/shared/keybindings.test.ts`
Expected: FAIL — actions and defaults missing.

- [ ] **Step 3: Add the actions and defaults**

In `src/shared/keybindings.ts`, extend the `keybindingActions` tuple:

```ts
export const keybindingActions = [
  'file:new',
  'file:open',
  'file:quick-open',
  'file:save',
  'file:copy-path',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'view:toggle-toc',
  'help:show',
  'nav:back',
  'nav:forward',
] as const;
```

Add defaults to `defaultKeybindings`:

```ts
export const defaultKeybindings: Readonly<Record<KeybindingAction, string>> = {
  'file:new': 'CmdOrCtrl+N',
  'file:open': 'CmdOrCtrl+O',
  'file:quick-open': 'CmdOrCtrl+P',
  'file:save': 'CmdOrCtrl+S',
  'file:copy-path': 'C',
  'tab:close': 'CmdOrCtrl+W',
  'tab:prev': 'Ctrl+,',
  'tab:next': 'Ctrl+.',
  'view:toggle-edit': 'T',
  'view:toggle-toc': 'O',
  'help:show': 'CmdOrCtrl+/',
  'nav:back': 'Ctrl+[',
  'nav:forward': 'Ctrl+]',
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run tests/shared/keybindings.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/keybindings.ts tests/shared/keybindings.test.ts
git commit -m "$(cat <<'EOF'
feat(keybindings): register nav:back (Ctrl+[) and nav:forward (Ctrl+])

Declares the two navigation shortcuts in the customizable keybinding
system. App will wire these to goBack/goForward in a later commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create NavigationContext

**Files:**
- Create: `src/renderer/contexts/NavigationContext.ts`

Creates the React context that Link will consume. No tests yet — the context is trivial and will be covered by Link tests.

- [ ] **Step 1: Create the context file**

Create `src/renderer/contexts/NavigationContext.ts`:

```ts
import { createContext } from 'react';

export type NavigationContextValue = {
  readonly onNavigate: (href: string) => void;
  readonly flashTargetHref: string | null;
};

const noopNavigate = (): void => {};

export const NavigationContext = createContext<NavigationContextValue>({
  onNavigate: noopNavigate,
  flashTargetHref: null,
});
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Run unit tests to confirm no breakage**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/contexts/NavigationContext.ts
git commit -m "$(cat <<'EOF'
feat(nav): add NavigationContext for link-driven in-tab navigation

Defines the context shape consumed by Link components to dispatch
navigation and receive flash-on-failure signals without prop drilling
through the markdown processor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Refactor Link component to use NavigationContext

**Files:**
- Modify: `src/renderer/components/markdown/Link.tsx`
- Create: `tests/renderer/components/Link.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/components/Link.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationContext } from '../../../src/renderer/contexts/NavigationContext';
import { Link } from '../../../src/renderer/components/markdown/Link';

type ApiShape = {
  readonly invoke: (channel: string, ...args: readonly unknown[]) => Promise<unknown>;
};

const setupApi = (invoke: ApiShape['invoke'] = vi.fn()): ApiShape => {
  const api: ApiShape = { invoke };
  Object.defineProperty(window, 'api', { value: api, configurable: true, writable: true });
  return api;
};

describe('Link', () => {
  it('calls file:open-external for http links', () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    setupApi(invoke);
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: null }}>
        <Link href="https://example.com">ext</Link>
      </NavigationContext.Provider>,
    );
    fireEvent.click(screen.getByText('ext'));
    expect(invoke).toHaveBeenCalledWith('file:open-external', 'https://example.com');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does nothing (no preventDefault, no onNavigate) for in-page anchors', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: null }}>
        <Link href="#section">a</Link>
      </NavigationContext.Provider>,
    );
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('a').dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate for relative .md links', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: null }}>
        <Link href="docs/foo.md">doc</Link>
      </NavigationContext.Provider>,
    );
    fireEvent.click(screen.getByText('doc'));
    expect(onNavigate).toHaveBeenCalledWith('docs/foo.md');
  });

  it('calls onNavigate for relative .markdown links', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: null }}>
        <Link href="foo.markdown">mk</Link>
      </NavigationContext.Provider>,
    );
    fireEvent.click(screen.getByText('mk'));
    expect(onNavigate).toHaveBeenCalledWith('foo.markdown');
  });

  it('calls onNavigate for .md with anchor', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: null }}>
        <Link href="docs/foo.md#intro">doc</Link>
      </NavigationContext.Provider>,
    );
    fireEvent.click(screen.getByText('doc'));
    expect(onNavigate).toHaveBeenCalledWith('docs/foo.md#intro');
  });

  it('renders link-flash class when flashTargetHref matches href', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: 'docs/gone.md' }}>
        <Link href="docs/gone.md">gone</Link>
      </NavigationContext.Provider>,
    );
    const el = screen.getByText('gone');
    expect(el.className).toMatch(/link-flash/);
  });

  it('does not add link-flash class when flashTargetHref does not match', () => {
    setupApi();
    const onNavigate = vi.fn();
    render(
      <NavigationContext.Provider value={{ onNavigate, flashTargetHref: 'docs/other.md' }}>
        <Link href="docs/gone.md">gone</Link>
      </NavigationContext.Provider>,
    );
    const el = screen.getByText('gone');
    expect(el.className).not.toMatch(/link-flash/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --run tests/renderer/components/Link.test.tsx`
Expected: FAIL — either the file doesn't compile because `Link` still uses the old `onOpenFile` prop, or `link-flash` class is missing.

- [ ] **Step 3: Rewrite `Link.tsx`**

Replace the entire contents of `src/renderer/components/markdown/Link.tsx`:

```tsx
import { type FC, type PropsWithChildren, type MouseEvent, useContext } from 'react';
import { NavigationContext } from '../../contexts/NavigationContext';

type LinkProps = PropsWithChildren<{
  readonly href: string;
}>;

const isExternalUrl = (href: string): boolean =>
  href.startsWith('http://') || href.startsWith('https://');

const isAnchor = (href: string): boolean => href.startsWith('#');

const isMarkdownLink = (href: string): boolean => {
  const pathPart = href.split('#')[0] ?? '';
  return pathPart.endsWith('.md') || pathPart.endsWith('.markdown');
};

export const Link: FC<LinkProps> = ({ href, children }) => {
  const { onNavigate, flashTargetHref } = useContext(NavigationContext);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    if (isAnchor(href)) return;
    e.preventDefault();
    if (isExternalUrl(href)) {
      void window.api.invoke('file:open-external', href);
      return;
    }
    if (isMarkdownLink(href)) {
      onNavigate(href);
    }
  };

  const className = flashTargetHref === href ? 'link link-flash' : 'link';

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run tests/renderer/components/Link.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full unit test suite**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/markdown/Link.tsx tests/renderer/components/Link.test.tsx
git commit -m "$(cat <<'EOF'
feat(link): consume NavigationContext and support flash feedback

Link now dispatches in-tab navigation via NavigationContext and renders
a link-flash class when the provided flashTargetHref matches. Dead
onOpenFile prop removed. External and in-page anchor behavior preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add `.link-flash` error style

**Files:**
- Modify: `src/renderer/styles/markdown.css`

The existing `.link` rule lives at `src/renderer/styles/markdown.css:92-93`.

- [ ] **Step 1: Append the flash style**

Append at the end of `src/renderer/styles/markdown.css`:

```css
.link.link-flash {
  animation: link-flash-anim 200ms ease-out;
}

@keyframes link-flash-anim {
  0%   { outline: 2px solid #e74c3c; outline-offset: 2px; background-color: rgba(231, 76, 60, 0.15); }
  100% { outline: 2px solid transparent; outline-offset: 2px; background-color: transparent; }
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/markdown.css
git commit -m "$(cat <<'EOF'
feat(link): add red-flash error animation for broken link clicks

200ms outline + background flash signals navigation failure (missing
target file or modified-tab guard) without interrupting reading flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire up `App.handleNavigate` with NavigationContext provider

**Files:**
- Modify: `src/renderer/App.tsx`

This task connects the Link component to navigation logic. It does not yet handle back/forward keybindings (next task).

- [ ] **Step 1: Read the current App.tsx to locate insertion points**

Run: `grep -n "handleOpenFile\|const { rendered\|<MarkdownView\|NavigationContext" src/renderer/App.tsx`

Record line numbers; they anchor the edits below.

- [ ] **Step 2: Import the context and helpers at the top**

Add to the import block at the top of `src/renderer/App.tsx`:

```ts
import { NavigationContext } from './contexts/NavigationContext';
```

- [ ] **Step 3: Add flash and navigate state/handler**

Inside the `App` function body, near other `useState` calls (after the `tocVisible` state), add:

```ts
const [flashTargetHref, setFlashTargetHref] = useState<string | null>(null);
const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const triggerFlash = useCallback((href: string) => {
  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  setFlashTargetHref(href);
  flashTimerRef.current = setTimeout(() => {
    setFlashTargetHref(null);
    flashTimerRef.current = null;
  }, 200);
}, []);

useEffect(() => () => {
  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
}, []);
```

- [ ] **Step 4: Extend the `useTabs()` destructuring**

Locate the line that destructures the hook (around line 22):

```ts
const { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab, updateTabContent, markTabSaved, reloadTab, forceReloadTab, createNewTab, promoteTab } = useTabs();
```

Replace with:

```ts
const { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab, updateTabContent, markTabSaved, reloadTab, forceReloadTab, createNewTab, promoteTab, navigateTab, commitNavigateToIndex } = useTabs();
```

- [ ] **Step 5: Add the `handleNavigate` callback**

Below the existing `handleOpenFile` definition, add:

```ts
const handleNavigate = useCallback(async (href: string) => {
  if (!activeTab || !activeTab.filePath) {
    triggerFlash(href);
    return;
  }
  if (activeTab.modified) {
    triggerFlash(href);
    return;
  }
  const hashIdx = href.indexOf('#');
  const relPath = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const anchorId = hashIdx === -1 ? undefined : href.slice(hashIdx + 1);
  try {
    const absPath = await window.api.invoke('file:resolve-path', activeTab.filePath, relPath);
    const content = await window.api.invoke('file:read', absPath);
    const parts = absPath.split('/');
    const fileName = parts[parts.length - 1] ?? absPath;
    navigateTab(activeTab.id, { filePath: absPath, fileName, content, anchorId }, topLineRef.current);
    void window.api.invoke('file:watch', absPath);
    await window.api.invoke('history:add', absPath);
  } catch (err) {
    console.warn('[mdlink] navigation failed', href, err);
    triggerFlash(href);
  }
}, [activeTab, navigateTab, triggerFlash]);
```

- [ ] **Step 6: Provide the context around MarkdownView**

Find the existing render block (around `src/renderer/App.tsx:423-428`):

```tsx
<MarkdownView
  rendered={renderedMarkdown}
  initialLine={topLineRef.current}
  scrollSettings={settings.scroll}
  onTopLineChange={(line) => { topLineRef.current = line; }}
/>
```

Wrap it with the provider:

```tsx
<NavigationContext.Provider value={{ onNavigate: handleNavigate, flashTargetHref }}>
  <MarkdownView
    rendered={renderedMarkdown}
    initialLine={topLineRef.current}
    scrollSettings={settings.scroll}
    onTopLineChange={(line) => { topLineRef.current = line; }}
  />
</NavigationContext.Provider>
```

Leave the `MarkdownEditor` branch alone — `Link` components do not render in edit mode.

- [ ] **Step 7: Run the full unit suite**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 8: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "$(cat <<'EOF'
feat(nav): wire handleNavigate and flash state to Link via context

Clicking a relative markdown link now resolves against the active tab's
filePath, reads the target, and commits a navigateTab update. Modified
tabs block navigation with the same red-flash feedback as missing files.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Back/forward keybindings and handlers

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Import pure peek helpers**

Update the `useTabs` import line:

```ts
import { useTabs, peekBack, peekForward } from './hooks/useTabs';
```

(`commitNavigateToIndex` is already destructured from `useTabs()` in Task 9 Step 4.)

- [ ] **Step 2: Add goBack/goForward handlers**

Below `handleNavigate`, add:

```ts
const handleGoBack = useCallback(async () => {
  if (!activeTab || activeTab.modified) return;
  const target = peekBack(activeTab);
  if (!target) return;
  try {
    const content = await window.api.invoke('file:read', target.filePath);
    const parts = target.filePath.split('/');
    const fileName = parts[parts.length - 1] ?? target.filePath;
    commitNavigateToIndex(activeTab.id, activeTab.historyIndex - 1, content, fileName, topLineRef.current);
    void window.api.invoke('file:watch', target.filePath);
  } catch (err) {
    console.warn('[mdlink] goBack failed', target.filePath, err);
  }
}, [activeTab, commitNavigateToIndex]);

const handleGoForward = useCallback(async () => {
  if (!activeTab || activeTab.modified) return;
  const target = peekForward(activeTab);
  if (!target) return;
  try {
    const content = await window.api.invoke('file:read', target.filePath);
    const parts = target.filePath.split('/');
    const fileName = parts[parts.length - 1] ?? target.filePath;
    commitNavigateToIndex(activeTab.id, activeTab.historyIndex + 1, content, fileName, topLineRef.current);
    void window.api.invoke('file:watch', target.filePath);
  } catch (err) {
    console.warn('[mdlink] goForward failed', target.filePath, err);
  }
}, [activeTab, commitNavigateToIndex]);
```

- [ ] **Step 3: Register keybindings**

In the `handleKeyDown` function (look for existing `matchAccelerator` calls), add before the closing `};` of the inner handler:

```ts
if (matchAccelerator(e, kb['nav:back'], isMac)) {
  e.preventDefault();
  void handleGoBack();
}
if (matchAccelerator(e, kb['nav:forward'], isMac)) {
  e.preventDefault();
  void handleGoForward();
}
```

Update the dependency array of the `useEffect` that registers `handleKeyDown` to include `handleGoBack` and `handleGoForward`.

- [ ] **Step 4: Run unit suite**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "$(cat <<'EOF'
feat(nav): bind Ctrl+[ / Ctrl+] to in-tab back/forward

Reads the previous/next history entry via peekBack/peekForward, fetches
the file fresh from disk, and commits via commitNavigateToIndex.
Modified tabs are skipped to protect unsaved edits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: MarkdownView accepts `initialAnchorId` and remounts on history change

**Files:**
- Modify: `src/renderer/components/MarkdownView.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add `initialAnchorId` prop to MarkdownView**

In `src/renderer/components/MarkdownView.tsx`, update the prop type:

```ts
type MarkdownViewProps = {
  readonly rendered: ReactElement;
  readonly initialLine?: number;
  readonly initialAnchorId?: string;
  readonly scrollSettings: ScrollSettings;
  readonly onTopLineChange?: (line: number) => void;
};
```

Update the component signature:

```ts
export const MarkdownView: FC<MarkdownViewProps> = ({ rendered, initialLine, initialAnchorId, scrollSettings, onTopLineChange }) => {
```

- [ ] **Step 2: Use `initialAnchorId` inside the mount-only effect**

Replace the existing mount-only effect (`useEffect(() => { ... }, [])` block that uses `initialLineRef`):

```ts
const initialLineRef = useRef(initialLine);
const initialAnchorIdRef = useRef(initialAnchorId);
useEffect(() => {
  const el = containerRef.current;
  const line = initialLineRef.current;
  const anchorId = initialAnchorIdRef.current;
  if (!el) return;
  requestAnimationFrame(() => {
    if (anchorId) {
      const target = document.getElementById(anchorId);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    if (line !== undefined) scrollToLine(el, line);
  });
}, []);
```

- [ ] **Step 3: Pass history-derived props from App**

In `src/renderer/App.tsx`, the MarkdownView block (after Task 9) looks like:

```tsx
<NavigationContext.Provider value={{ onNavigate: handleNavigate, flashTargetHref }}>
  <MarkdownView
    rendered={renderedMarkdown}
    initialLine={topLineRef.current}
    scrollSettings={settings.scroll}
    onTopLineChange={(line) => { topLineRef.current = line; }}
  />
</NavigationContext.Provider>
```

Replace it with:

```tsx
<NavigationContext.Provider value={{ onNavigate: handleNavigate, flashTargetHref }}>
  <MarkdownView
    key={`${activeTab.id}-${activeTab.historyIndex}`}
    rendered={renderedMarkdown}
    initialLine={activeTab.history[activeTab.historyIndex]?.topLine ?? 1}
    initialAnchorId={activeTab.history[activeTab.historyIndex]?.anchorId}
    scrollSettings={settings.scroll}
    onTopLineChange={(line) => { topLineRef.current = line; }}
  />
</NavigationContext.Provider>
```

The `key` forces React to remount `MarkdownView` when the active tab or history index changes, which re-triggers the mount-only scroll-restoration effect. `activeTab` is guaranteed non-null here because the outer conditional already checked `activeTab ? ... : <Welcome />`.

- [ ] **Step 4: Run unit suite**

Run: `pnpm test -- --run`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Manual smoke check in dev**

Run: `pnpm dev`

Open a markdown file that has a relative link to another markdown file in the same directory. Click it and verify:
- Tab count stays the same
- Content replaces with the target document
- Ctrl+[ returns to the original, with scroll position approximately preserved
- Ctrl+] returns to the target
- Clicking a broken link flashes it red

If any of these fail, inspect the DevTools console for messages prefixed with `[mdlink]`.

Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/MarkdownView.tsx src/renderer/App.tsx
git commit -m "$(cat <<'EOF'
feat(view): scroll to anchor id and remount on history change

MarkdownView accepts an initialAnchorId that takes precedence over
initialLine. App passes a key derived from tab id + historyIndex so that
navigation events re-trigger the mount-only initial-scroll effect.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Playwright E2E coverage

**Files:**
- Create: `tests/e2e/linkNavigation.spec.ts`
- Create: `tests/e2e/fixtures/nav-a.md`, `tests/e2e/fixtures/nav-b.md`, `tests/e2e/fixtures/nav-c.md`

Existing E2E specs (`tests/e2e/app.spec.ts`, `tests/e2e/search.spec.ts`) are the reference patterns.

- [ ] **Step 1: Inspect an existing E2E spec for setup pattern**

Run: `cat tests/e2e/app.spec.ts | head -40`

Note the imports, Electron launch pattern, and how a file is opened. Reuse the same scaffolding.

- [ ] **Step 2: Create fixture markdown files**

Create `tests/e2e/fixtures/nav-a.md`:

```markdown
# Nav A

This links to [B](nav-b.md) and [B intro](nav-b.md#intro-heading).

This links to [missing](does-not-exist.md).

## Section

Content for scroll testing.
```

Create `tests/e2e/fixtures/nav-b.md`:

```markdown
# Nav B

Back to [A](nav-a.md).

## Intro Heading

Target for anchor navigation.
```

Create `tests/e2e/fixtures/nav-c.md`:

```markdown
# Nav C

From B via [C link](nav-c.md).
```

- [ ] **Step 3: Write the E2E spec**

Create `tests/e2e/linkNavigation.spec.ts`:

```ts
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

let app: ElectronApplication;
let page: Page;

const fixtureDir = path.join(__dirname, 'fixtures');
const fixtureA = path.join(fixtureDir, 'nav-a.md');

test.beforeEach(async () => {
  app = await electron.launch({ args: [path.join(__dirname, '../../out/main/main.js'), fixtureA] });
  page = await app.firstWindow();
  await page.waitForSelector('.markdown-view');
});

test.afterEach(async () => {
  await app.close();
});

test('clicking a relative .md link navigates within the same tab', async () => {
  const tabsBefore = await page.locator('.tab').count();
  await page.getByText('B', { exact: true }).first().click();
  await page.waitForSelector('text=Intro Heading');
  const tabsAfter = await page.locator('.tab').count();
  expect(tabsAfter).toBe(tabsBefore);
  await expect(page.locator('.markdown-content')).toContainText('Target for anchor navigation');
});

test('anchor link scrolls to the heading', async () => {
  await page.getByText('B intro').click();
  await page.waitForSelector('text=Intro Heading');
  const heading = page.locator('#intro-heading');
  const inView = await heading.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
  expect(inView).toBe(true);
});

test('Ctrl+[ goes back and Ctrl+] goes forward', async () => {
  await page.getByText('B', { exact: true }).first().click();
  await page.waitForSelector('text=Intro Heading');
  await page.keyboard.press('Control+BracketLeft');
  await page.waitForSelector('text=Section');
  await expect(page.locator('.markdown-content')).toContainText('Nav A');
  await page.keyboard.press('Control+BracketRight');
  await page.waitForSelector('text=Intro Heading');
  await expect(page.locator('.markdown-content')).toContainText('Nav B');
});

test('navigating after a back truncates forward history', async () => {
  await page.getByText('B', { exact: true }).first().click();
  await page.waitForSelector('text=Intro Heading');
  await page.keyboard.press('Control+BracketLeft');
  await page.waitForSelector('text=Section');
  // Click a different link — forward history should be dropped
  await page.getByText('B intro').click();
  await page.waitForSelector('text=Intro Heading');
  // Forward should now be a NOOP
  await page.keyboard.press('Control+BracketRight');
  // Still on B (no change)
  await expect(page.locator('.markdown-content')).toContainText('Nav B');
});

test('broken link flashes red and does not navigate', async () => {
  const linkLocator = page.getByText('missing');
  await linkLocator.click();
  // The link should briefly have the link-flash class
  const className = await linkLocator.evaluate((el) => el.className);
  expect(className).toContain('link-flash');
  // Content did not change
  await expect(page.locator('.markdown-content')).toContainText('Nav A');
});
```

- [ ] **Step 4: Build the app for E2E**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Run the E2E spec**

Run: `pnpm test:e2e -- tests/e2e/linkNavigation.spec.ts`
Expected: all tests PASS. If the `missing` link test fails with a timing issue, extend the assertion — capture the class immediately after the click via `page.evaluate` in the same microtask.

If a test fails for a real reason, stop and investigate. Do not weaken an assertion to make it pass.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/linkNavigation.spec.ts tests/e2e/fixtures/nav-a.md tests/e2e/fixtures/nav-b.md tests/e2e/fixtures/nav-c.md
git commit -m "$(cat <<'EOF'
test(e2e): cover markdown link navigation, anchors, back/forward, flash

Exercises the full navigation flow end-to-end including forward-history
truncation and the red-flash feedback for broken links.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Production build verification

- [ ] **Step 1: Run the production build**

Run: `pnpm run build:app`
Expected: `dist/mac-arm64/Reed.app` is produced, ad-hoc signed, no errors.

- [ ] **Step 2: Smoke check the packaged app manually**

Open the packaged `Reed.app`, load `tests/e2e/fixtures/nav-a.md`, click links, try Ctrl+[ and Ctrl+], verify the missing-link flash.

If everything works, the feature is complete. If a defect surfaces, open a new TDD loop — do not patch the production build directly.

---

## Self-Review Checklist

After completing all tasks, verify the plan delivered every spec requirement:

- [x] Clicking a relative `.md`/`.markdown` link navigates the current tab — Tasks 3, 7, 9
- [x] Anchor suffix scrolls to heading — Tasks 9 (split), 11 (anchor scroll)
- [x] Target already open in another tab → still navigates current tab (duplicates allowed) — `navigateTab` does not dedupe (Task 3)
- [x] Missing file → red flash, no navigation — Task 7 (style), Task 9 (trigger)
- [x] Modified-tab guard on clicks and on Ctrl+[/] — Tasks 9, 10
- [x] Ctrl+[ back / Ctrl+] forward — Tasks 5 (bindings), 10 (handlers)
- [x] Back/forward scroll restoration via `topLine` — Task 4 (commit), Task 11 (remount + initialLine)
- [x] Forward-history truncation on new navigate — Task 3
- [x] Silent NOOP on deleted history target — Task 10 (try/catch)
- [x] Untitled tab has empty history, navigation NOOP — Task 2, 3
- [x] Path resolution via existing `file:resolve-path` — Task 9
