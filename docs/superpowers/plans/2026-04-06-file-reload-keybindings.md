# File Auto-Reload & Keybinding System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 열린 마크다운 파일이 외부에서 수정되면 자동으로 내용을 리로드하고, (2) 모든 단축키를 settings.json에서 설정 가능하게 하며, Ctrl+,/Ctrl+. 탭 이동 단축키와 메뉴를 추가한다.

**Architecture:** Main process에서 `fs.watch()`로 파일 변경을 감지하여 renderer에 알리고, renderer는 modified가 아닌 탭만 리로드한다. 키바인딩은 `AppSettings.keybindings`에 action→accelerator 맵으로 저장하며, 기본값은 코드에 하드코딩하고 사용자 설정이 오버라이드한다. 메뉴와 renderer 키보드 핸들러 모두 이 설정을 참조한다.

**Tech Stack:** Electron fs.watch, IPC, electron-store, React

---

## File Structure

### New Files
- `src/main/ipc/fileWatchHandlers.ts` — 파일 감시 IPC 핸들러 (watch/unwatch/cleanup)
- `src/shared/keybindings.ts` — 기본 키바인딩 정의 + 타입
- `tests/main/ipc/fileWatchHandlers.test.ts` — 파일 감시 핸들러 유닛 테스트
- `tests/shared/keybindings.test.ts` — 키바인딩 병합 로직 테스트

### Modified Files
- `src/shared/types.ts` — `AppSettings`에 keybindings 추가, IPC 채널 추가
- `src/main/main.ts` — fileWatchHandlers 등록, 메뉴에 settings 전달
- `src/main/menu.ts` — 키바인딩 설정 기반 accelerator + 탭 이동 메뉴 항목
- `src/main/ipc/settingsHandlers.ts` — defaultSettings에 keybindings 포함
- `src/preload/preload.ts` — 변경 없음 (기존 `on`/`invoke` API로 충분)
- `src/renderer/App.tsx` — 파일 변경 이벤트 리스닝, 키바인딩 설정 기반 단축키, 탭 이동 IPC 리스닝
- `src/renderer/hooks/useTabs.ts` — `reloadTab` 함수 추가
- `src/renderer/hooks/useSettings.ts` — keybindings 포함된 설정 반환
- `tests/e2e/app.spec.ts` — 파일 리로드 + 탭 이동 e2e 테스트

---

## Task 1: 키바인딩 타입 및 기본값 정의

**Files:**
- Create: `src/shared/keybindings.ts`
- Modify: `src/shared/types.ts`
- Test: `tests/shared/keybindings.test.ts`

- [ ] **Step 1: Write failing test for keybinding merge logic**

```typescript
// tests/shared/keybindings.test.ts
import { describe, it, expect } from 'vitest';
import { defaultKeybindings, mergeKeybindings } from '../../src/shared/keybindings';
import type { KeybindingAction } from '../../src/shared/keybindings';

describe('keybindings', () => {
  it('should return all default keybindings when no overrides', () => {
    const result = mergeKeybindings(undefined);
    expect(result).toEqual(defaultKeybindings);
  });

  it('should override specific keybindings while keeping defaults', () => {
    const overrides: Partial<Record<KeybindingAction, string>> = {
      'tab:prev': 'CmdOrCtrl+Shift+Tab',
    };
    const result = mergeKeybindings(overrides);
    expect(result['tab:prev']).toBe('CmdOrCtrl+Shift+Tab');
    expect(result['file:open']).toBe(defaultKeybindings['file:open']);
  });

  it('should handle empty overrides object', () => {
    const result = mergeKeybindings({});
    expect(result).toEqual(defaultKeybindings);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/shared/keybindings.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add KeybindingAction type and AppSettings update**

Modify `src/shared/types.ts` — add keybindings to AppSettings:

```typescript
// Add to the end of AppSettings type, before the closing brace:
export type AppSettings = {
  readonly scroll: ScrollSettings;
  readonly lightTheme?: ThemeOverrides;
  readonly darkTheme?: ThemeOverrides;
  readonly keybindings?: Partial<Record<string, string>>;
};
```

- [ ] **Step 4: Create keybindings module with defaults and merge**

Create `src/shared/keybindings.ts`:

```typescript
export const keybindingActions = [
  'file:open',
  'file:quick-open',
  'file:save',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'help:show',
] as const;

export type KeybindingAction = (typeof keybindingActions)[number];

export const defaultKeybindings: Readonly<Record<KeybindingAction, string>> = {
  'file:open': 'CmdOrCtrl+O',
  'file:quick-open': 'CmdOrCtrl+P',
  'file:save': 'CmdOrCtrl+S',
  'tab:close': 'CmdOrCtrl+W',
  'tab:prev': 'Ctrl+,',
  'tab:next': 'Ctrl+.',
  'view:toggle-edit': 'T',
  'help:show': 'CmdOrCtrl+/',
};

export const mergeKeybindings = (
  overrides: Partial<Record<string, string>> | undefined,
): Record<KeybindingAction, string> => ({
  ...defaultKeybindings,
  ...overrides,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/shared/keybindings.test.ts`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: 0 violations

- [ ] **Step 7: Commit**

```bash
git add src/shared/keybindings.ts src/shared/types.ts tests/shared/keybindings.test.ts
git commit -m "feat(keybindings): add keybinding types, defaults, and merge logic"
```

---

## Task 2: settings에 keybindings 기본값 반영

**Files:**
- Modify: `src/main/ipc/settingsHandlers.ts`

- [ ] **Step 1: Update defaultSettings in settingsHandlers.ts**

`src/main/ipc/settingsHandlers.ts`의 `defaultSettings`에는 keybindings를 추가하지 않는다. `AppSettings.keybindings`는 optional이므로, 사용자가 설정하지 않으면 `undefined`가 되고, renderer에서 `mergeKeybindings(settings.keybindings)`로 기본값이 적용된다. 따라서 이 태스크는 settingsHandlers.ts는 변경 불필요.

대신 `src/renderer/hooks/useSettings.ts`의 defaultSettings도 동일하게 keybindings 없이 유지 (이미 optional이므로 변경 불필요).

- [ ] **Step 2: Verify existing tests still pass**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 3: Commit (skip if no changes)**

변경 없으므로 커밋 불필요. 다음 태스크로 이동.

---

## Task 3: 메뉴에 키바인딩 설정 적용 + 탭 이동 메뉴 추가

**Files:**
- Modify: `src/main/menu.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/ipc/settingsHandlers.ts` (getSettings export 확인)

- [ ] **Step 1: Modify menu.ts to accept keybindings and add tab navigation**

`src/main/menu.ts`를 수정하여 `createMenu`가 keybindings를 받고, View 메뉴에 탭 이동 항목을 추가:

```typescript
import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { getSettingsPath } from './ipc/settingsHandlers';
import { defaultKeybindings, mergeKeybindings } from '../shared/keybindings';
import type { AppSettings } from '../shared/types';

// ... helpContent는 기존 그대로 유지하되 Tabs 섹션에 Ctrl+,/Ctrl+. 추가 ...

export const createMenu = (mainWindow: BrowserWindow, settings: AppSettings): Menu => {
  const kb = mergeKeybindings(settings.keybindings);

  const template: ReadonlyArray<MenuItemConstructorOptions> = [
    // App menu — 기존 그대로
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: () => { void shell.openPath(getSettingsPath()); },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    // File menu — accelerator를 kb에서 읽기
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: kb['file:open'],
          click: () => { mainWindow.webContents.send('menu:open-file'); },
        },
        {
          label: 'Quick Open',
          accelerator: kb['file:quick-open'],
          click: () => { mainWindow.webContents.send('menu:quick-open'); },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: kb['file:save'],
          click: () => { mainWindow.webContents.send('menu:save'); },
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: kb['tab:close'],
          click: () => { mainWindow.webContents.send('menu:close-tab'); },
        },
      ],
    },
    // Edit — 기존 그대로
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // View — Toggle Edit + Tab navigation 추가
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Edit Mode',
          accelerator: kb['view:toggle-edit'],
          click: () => { mainWindow.webContents.send('menu:toggle-edit'); },
          registerAccelerator: false,
        },
        { type: 'separator' },
        {
          label: 'Previous Tab',
          accelerator: kb['tab:prev'],
          click: () => { mainWindow.webContents.send('menu:prev-tab'); },
        },
        {
          label: 'Next Tab',
          accelerator: kb['tab:next'],
          click: () => { mainWindow.webContents.send('menu:next-tab'); },
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    // Window — 기존 그대로
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    // Help — accelerator를 kb에서 읽기
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Reed Help',
          click: () => { showHelp(mainWindow); },
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts',
          accelerator: kb['help:show'],
          click: () => { showHelp(mainWindow); },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate([...template]);
};
```

- [ ] **Step 2: Update helpContent to include Ctrl+,/Ctrl+. shortcuts**

helpContent의 Tabs 섹션에 추가:

```
| Ctrl+, | Previous tab |
| Ctrl+. | Next tab |
```

- [ ] **Step 3: Update main.ts to pass settings to createMenu**

`src/main/main.ts` 수정:

```typescript
import { getSettings } from './ipc/settingsHandlers';

// ... app.whenReady 내부에서:
const settings = getSettings();
const mainWindow = createWindow();
const menu = createMenu(mainWindow, settings);
Menu.setApplicationMenu(menu);
```

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test && pnpm lint`
Expected: All PASS, 0 violations

- [ ] **Step 5: Commit**

```bash
git add src/main/menu.ts src/main/main.ts
git commit -m "feat(menu): apply keybindings from settings and add tab navigation menu items"
```

---

## Task 4: Renderer 키보드 핸들러를 설정 기반으로 전환

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add accelerator matching utility to App.tsx**

App.tsx 상단에 accelerator 문자열을 KeyboardEvent와 매칭하는 헬퍼 추가:

```typescript
const matchAccelerator = (e: KeyboardEvent, accelerator: string): boolean => {
  const parts = accelerator.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';

  const needCmd = parts.includes('cmdorctrl') || parts.includes('cmd') || parts.includes('command');
  const needCtrl = parts.includes('ctrl') || parts.includes('control');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt') || parts.includes('option');

  const isMac = navigator.platform.startsWith('Mac');
  const modifierMatch = isMac
    ? (needCmd ? e.metaKey : !e.metaKey) && (needCtrl ? e.ctrlKey : !e.ctrlKey)
    : ((needCmd || needCtrl) ? e.ctrlKey : !e.ctrlKey) && !e.metaKey;

  const shiftMatch = needShift ? e.shiftKey : !e.shiftKey;
  const altMatch = needAlt ? e.altKey : !e.altKey;

  const eventKey = e.key.toLowerCase();
  const keyMatch = key === ',' ? eventKey === ',' :
    key === '.' ? eventKey === '.' :
    key === '/' ? eventKey === '/' :
    key === eventKey;

  return modifierMatch && shiftMatch && altMatch && keyMatch;
};
```

- [ ] **Step 2: Update useEffect keyboard handler to use settings-based keybindings**

기존 하드코딩된 `e.metaKey && e.key === 'o'` 등의 조건을 `matchAccelerator(e, kb['file:open'])` 형태로 교체.

탭 이동 단축키(tab:prev, tab:next)도 동일하게 처리. 기존 `Cmd+Shift+[`/`Cmd+Shift+]`는 유지하되, 설정 기반 `tab:prev`/`tab:next`도 함께 동작하도록.

또한 `menu:prev-tab`, `menu:next-tab` IPC 이벤트 리스너 추가:

```typescript
useEffect(() => {
  const unsubPrev = window.api.on('menu:prev-tab', () => {
    // prev tab logic
  });
  const unsubNext = window.api.on('menu:next-tab', () => {
    // next tab logic
  });
  return () => { unsubPrev(); unsubNext(); };
}, [tabs, activeTabId, setActiveTab]);
```

- [ ] **Step 3: Load keybindings from settings in App**

```typescript
const settings = useSettings();
const kb = mergeKeybindings(settings.keybindings);
```

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test && pnpm lint`
Expected: All PASS, 0 violations

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(keybindings): use settings-based keybindings in renderer keyboard handler"
```

---

## Task 5: 파일 감시 핸들러 구현

**Files:**
- Create: `src/main/ipc/fileWatchHandlers.ts`
- Create: `tests/main/ipc/fileWatchHandlers.test.ts`
- Modify: `src/shared/types.ts` (IPC 채널 추가)

- [ ] **Step 1: Write failing test for file watch handlers**

```typescript
// tests/main/ipc/fileWatchHandlers.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

vi.mock('node:fs', () => ({
  watch: vi.fn(() => ({ close: vi.fn() })),
  existsSync: vi.fn(() => true),
}));

import { createFileWatcher } from '../../../src/main/ipc/fileWatchHandlers';

describe('fileWatchHandlers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should track watched files', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');
    expect(watcher.isWatching('/test/file.md')).toBe(true);
  });

  it('should not duplicate watchers for same file', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');
    watcher.watch('/test/file.md');
    expect(watcher.watchCount()).toBe(1);
  });

  it('should remove watcher on unwatch', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');
    watcher.unwatch('/test/file.md');
    expect(watcher.isWatching('/test/file.md')).toBe(false);
  });

  it('should clean up all watchers', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/a.md');
    watcher.watch('/test/b.md');
    watcher.cleanup();
    expect(watcher.watchCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/main/ipc/fileWatchHandlers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add IPC channels to types.ts**

`src/shared/types.ts`에 새 IPC 채널 추가:

```typescript
'file:watch': { args: readonly [filePath: string]; return: undefined };
'file:unwatch': { args: readonly [filePath: string]; return: undefined };
```

- [ ] **Step 4: Implement file watch handler**

Create `src/main/ipc/fileWatchHandlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { watch, existsSync, type FSWatcher } from 'node:fs';

type FileWatcher = {
  readonly watch: (filePath: string) => void;
  readonly unwatch: (filePath: string) => void;
  readonly cleanup: () => void;
  readonly isWatching: (filePath: string) => boolean;
  readonly watchCount: () => number;
};

export const createFileWatcher = (): FileWatcher => {
  const watchers = new Map<string, FSWatcher>();

  const notifyRenderer = (filePath: string): void => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('file:changed', filePath);
    });
  };

  let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const watchFile = (filePath: string): void => {
    if (watchers.has(filePath)) return;
    if (!existsSync(filePath)) return;

    const fsWatcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        const existing = debounceTimers.get(filePath);
        if (existing) clearTimeout(existing);
        debounceTimers.set(filePath, setTimeout(() => {
          debounceTimers.delete(filePath);
          if (existsSync(filePath)) {
            notifyRenderer(filePath);
          }
        }, 300));
      }
    });

    watchers.set(filePath, fsWatcher);
  };

  const unwatchFile = (filePath: string): void => {
    const fsWatcher = watchers.get(filePath);
    if (fsWatcher) {
      fsWatcher.close();
      watchers.delete(filePath);
    }
    const timer = debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(filePath);
    }
  };

  const cleanup = (): void => {
    watchers.forEach((w) => w.close());
    watchers.clear();
    debounceTimers.forEach((t) => clearTimeout(t));
    debounceTimers.clear();
  };

  return {
    watch: watchFile,
    unwatch: unwatchFile,
    cleanup,
    isWatching: (filePath: string) => watchers.has(filePath),
    watchCount: () => watchers.size,
  };
};

export const registerFileWatchHandlers = (): ReturnType<typeof createFileWatcher> => {
  const watcher = createFileWatcher();

  ipcMain.handle('file:watch', (_event, filePath: string) => {
    watcher.watch(filePath);
  });

  ipcMain.handle('file:unwatch', (_event, filePath: string) => {
    watcher.unwatch(filePath);
  });

  return watcher;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/main/ipc/fileWatchHandlers.test.ts`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: 0 violations

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/fileWatchHandlers.ts src/shared/types.ts tests/main/ipc/fileWatchHandlers.test.ts
git commit -m "feat(watch): add file watcher IPC handlers with debounce"
```

---

## Task 6: Main process에 파일 감시 등록 + cleanup

**Files:**
- Modify: `src/main/main.ts`

- [ ] **Step 1: Register file watch handlers in main.ts**

```typescript
import { registerFileWatchHandlers } from './ipc/fileWatchHandlers';

// app.whenReady 내부:
const fileWatcher = registerFileWatchHandlers();

// window-all-closed에서 cleanup:
app.on('window-all-closed', () => {
  fileWatcher.cleanup();
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 2: Run tests and lint**

Run: `pnpm test && pnpm lint`
Expected: All PASS, 0 violations

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat(watch): register file watcher in main process with cleanup"
```

---

## Task 7: Renderer에서 파일 변경 감지 및 리로드

**Files:**
- Modify: `src/renderer/hooks/useTabs.ts` — `reloadTab` 함수 추가
- Modify: `src/renderer/App.tsx` — watch/unwatch IPC 호출 + file:changed 리스닝

- [ ] **Step 1: Add reloadTab to useTabs hook**

`src/renderer/hooks/useTabs.ts`에 추가:

```typescript
const reloadTab = useCallback((filePath: string, content: string) => {
  setTabs((prev) =>
    prev.map((t) =>
      t.filePath === filePath && !t.modified ? { ...t, content } : t,
    ),
  );
}, []);
```

return에 `reloadTab` 추가.

- [ ] **Step 2: Add watch/unwatch calls and file:changed listener in App.tsx**

탭이 열릴 때 `file:watch`, 닫힐 때 `file:unwatch` 호출:

```typescript
// handleOpenFile 내부, openTab 호출 후:
void window.api.invoke('file:watch', filePath);

// 기존 closeTab을 래핑:
const handleCloseTab = useCallback((tabId: string) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    // 같은 파일의 다른 탭이 없으면 unwatch
    const otherWithSameFile = tabs.filter((t) => t.id !== tabId && t.filePath === tab.filePath);
    if (otherWithSameFile.length === 0) {
      void window.api.invoke('file:unwatch', tab.filePath);
    }
  }
  closeTab(tabId);
}, [tabs, closeTab]);
```

file:changed 이벤트 리스닝:

```typescript
useEffect(() => {
  const unsubscribe = window.api.on('file:changed', async (filePath: unknown) => {
    if (typeof filePath !== 'string') return;
    const content = await window.api.invoke('file:read', filePath);
    reloadTab(filePath, content);
  });
  return unsubscribe;
}, [reloadTab]);
```

TabBar의 `onClose`를 `handleCloseTab`으로 교체.

- [ ] **Step 3: Run tests and lint**

Run: `pnpm test && pnpm lint`
Expected: All PASS, 0 violations

- [ ] **Step 4: Commit**

```bash
git add src/renderer/hooks/useTabs.ts src/renderer/App.tsx
git commit -m "feat(watch): reload file content on external change in renderer"
```

---

## Task 8: E2E 테스트 — 파일 리로드

**Files:**
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: Add file auto-reload e2e test**

```typescript
test('should auto-reload when file is modified externally', async () => {
  const testFile = resolve(__dirname, '../../test-fixture-reload.md');
  writeFileSync(testFile, '# Original Content');

  try {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Open the file
    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.markdown-content h1')).toHaveText('Original Content');

    // Modify file externally
    writeFileSync(testFile, '# Updated Content');

    // Wait for auto-reload (debounce 300ms + some buffer)
    await expect(page.locator('.markdown-content h1')).toHaveText('Updated Content', { timeout: 5000 });

    await app.close();
  } finally {
    unlinkSync(testFile);
  }
});
```

- [ ] **Step 2: Add tab navigation e2e test**

```typescript
test('should navigate tabs with menu events', async () => {
  const testFile1 = resolve(__dirname, '../../test-tab1.md');
  const testFile2 = resolve(__dirname, '../../test-tab2.md');
  writeFileSync(testFile1, '# Tab 1');
  writeFileSync(testFile2, '# Tab 2');

  try {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Open two files
    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile1);
    await expect(page.locator('.tab-item')).toHaveCount(1, { timeout: 5000 });

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile2);
    await expect(page.locator('.tab-item')).toHaveCount(2, { timeout: 5000 });

    // Tab 2 should be active (last opened)
    await expect(page.locator('.markdown-content h1')).toHaveText('Tab 2');

    // Navigate to previous tab
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('menu:prev-tab');
    });

    await expect(page.locator('.markdown-content h1')).toHaveText('Tab 1', { timeout: 3000 });

    // Navigate to next tab
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('menu:next-tab');
    });

    await expect(page.locator('.markdown-content h1')).toHaveText('Tab 2', { timeout: 3000 });

    await app.close();
  } finally {
    unlinkSync(testFile1);
    unlinkSync(testFile2);
  }
});
```

- [ ] **Step 3: Build and run e2e tests**

Run: `pnpm build && pnpm test:e2e`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app.spec.ts
git commit -m "test(e2e): add file auto-reload and tab navigation tests"
```

---

## Task 9: Help 문서 업데이트 + 최종 빌드

**Files:**
- Modify: `src/main/menu.ts` (helpContent)

- [ ] **Step 1: Update helpContent in menu.ts**

Tabs 섹션에 추가:
```
| ⌃, | Previous tab |
| ⌃. | Next tab |
```

Settings 섹션에 keybindings 설명 추가:
```
### Keybindings

All keyboard shortcuts can be customized in settings:

\`\`\`json
{
  "settings": {
    "keybindings": {
      "file:open": "CmdOrCtrl+O",
      "file:quick-open": "CmdOrCtrl+P",
      "file:save": "CmdOrCtrl+S",
      "tab:close": "CmdOrCtrl+W",
      "tab:prev": "Ctrl+,",
      "tab:next": "Ctrl+.",
      "view:toggle-edit": "T",
      "help:show": "CmdOrCtrl+/"
    }
  }
}
\`\`\`
```

- [ ] **Step 2: Run full build**

Run: `pnpm run build:app`
Expected: Build success

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 violations

- [ ] **Step 4: Commit**

```bash
git add src/main/menu.ts
git commit -m "docs(help): add tab navigation shortcuts and keybinding customization guide"
```
