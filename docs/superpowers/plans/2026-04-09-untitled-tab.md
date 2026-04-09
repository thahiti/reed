# Untitled Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 탭을 열어 마크다운을 작성하고 Save As로 저장할 수 있는 기능 추가

**Architecture:** `Tab.filePath`를 `string | null`로 확장하여 Untitled 탭을 표현. filePath가 null이면 Untitled 탭으로 판별하고, 첫 저장 시 Save As 다이얼로그를 거쳐 일반 파일 탭으로 전환한다. 트리거는 Cmd+N, File 메뉴, 탭바 "+" 버튼 3가지.

**Tech Stack:** Electron 33+, TypeScript, React, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-04-09-untitled-tab-design.md`

---

### Task 1: Tab 타입에 nullable filePath 허용

**Files:**
- Modify: `src/shared/types.ts:26-32`
- Test: `tests/shared/types.test.ts`

- [ ] **Step 1: 타입 테스트 작성**

`tests/shared/types.test.ts`에 Untitled 탭 타입 호환성 테스트 추가:

```typescript
it('should allow Tab with null filePath', () => {
  const tab: Tab = {
    id: 'tab-1',
    filePath: null,
    fileName: 'Untitled',
    content: '',
    modified: false,
  };
  expect(tab.filePath).toBeNull();
  expect(tab.fileName).toBe('Untitled');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/shared/types.test.ts`
Expected: FAIL — `Type 'null' is not assignable to type 'string'`

- [ ] **Step 3: Tab 타입 변경**

`src/shared/types.ts`에서 `Tab.filePath` 수정:

```typescript
export type Tab = {
  readonly id: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
  readonly modified: boolean;
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/shared/types.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트 및 빌드 확인**

Run: `pnpm test && pnpm lint`
Expected: PASS (기존 코드에서 filePath를 string으로 좁히는 곳이 있으면 타입 에러 발생 가능 — 다음 태스크에서 수정)

- [ ] **Step 6: 커밋**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git commit -m "feat(types): allow nullable filePath in Tab for untitled tabs"
```

---

### Task 2: IPC — file:save-dialog 채널 추가

**Files:**
- Modify: `src/shared/types.ts:1-18` (IpcChannels)
- Modify: `src/main/ipc/fileHandlers.ts`
- Test: `tests/main/ipc/fileHandlers.test.ts`

- [ ] **Step 1: IpcChannels에 file:save-dialog 추가**

`src/shared/types.ts`의 IpcChannels에 추가:

```typescript
'file:save-dialog': { args: readonly []; return: string | null };
```

- [ ] **Step 2: 핸들러 유닛 테스트 작성**

`tests/main/ipc/fileHandlers.test.ts`에 dialog mock 추가 — 기존 vi.mock('electron')에 `showSaveDialog` 추가:

```typescript
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(), getAllWindows: vi.fn(() => []) },
}));
```

그리고 `showSaveDialog`를 export하는 헬퍼 함수를 테스트:

```typescript
import { dialog } from 'electron';

describe('showSaveDialogForMd', () => {
  it('should return file path when user selects a file', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/path/to/new-file.md',
    });
    const { showSaveDialogForMd } = await import('../../../src/main/ipc/fileHandlers');
    const result = await showSaveDialogForMd();
    expect(result).toBe('/path/to/new-file.md');
  });

  it('should return null when user cancels', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: true,
      filePath: undefined as unknown as string,
    });
    const { showSaveDialogForMd } = await import('../../../src/main/ipc/fileHandlers');
    const result = await showSaveDialogForMd();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm test -- tests/main/ipc/fileHandlers.test.ts`
Expected: FAIL — `showSaveDialogForMd is not a function`

- [ ] **Step 4: 핸들러 구현**

`src/main/ipc/fileHandlers.ts`에 추가:

```typescript
export const showSaveDialogForMd = async (): Promise<string | null> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(focusedWindow ?? new BrowserWindow(), {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  return result.canceled ? null : (result.filePath ?? null);
};
```

`registerFileHandlers()` 안에 핸들 등록:

```typescript
ipcMain.handle('file:save-dialog', () => showSaveDialogForMd());
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- tests/main/ipc/fileHandlers.test.ts`
Expected: PASS

- [ ] **Step 6: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 7: 커밋**

```bash
git add src/shared/types.ts src/main/ipc/fileHandlers.ts tests/main/ipc/fileHandlers.test.ts
git commit -m "feat(ipc): add file:save-dialog channel for Save As"
```

---

### Task 3: IPC — dialog:confirm-close 채널 추가

**Files:**
- Modify: `src/shared/types.ts:1-18` (IpcChannels)
- Create: `src/main/ipc/dialogHandlers.ts`
- Create: `tests/main/ipc/dialogHandlers.test.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: IpcChannels에 dialog:confirm-close 추가**

`src/shared/types.ts`의 IpcChannels에 추가:

```typescript
'dialog:confirm-close': { args: readonly [message: string]; return: number };
```

- [ ] **Step 2: 테스트 작성**

`tests/main/ipc/dialogHandlers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
}));

import { dialog } from 'electron';
import { showConfirmCloseDialog } from '../../../src/main/ipc/dialogHandlers';

describe('dialogHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showConfirmCloseDialog', () => {
    it('should return button index from message box', async () => {
      vi.mocked(dialog.showMessageBox).mockResolvedValue({
        response: 0,
        checkboxChecked: false,
      });
      const result = await showConfirmCloseDialog('저장하지 않은 내용이 있습니다.');
      expect(result).toBe(0);
      expect(vi.mocked(dialog.showMessageBox)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'warning',
          buttons: ['저장', '저장 안 함', '취소'],
        }),
      );
    });

    it('should return 2 when user clicks cancel', async () => {
      vi.mocked(dialog.showMessageBox).mockResolvedValue({
        response: 2,
        checkboxChecked: false,
      });
      const result = await showConfirmCloseDialog('저장하지 않은 내용이 있습니다.');
      expect(result).toBe(2);
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm test -- tests/main/ipc/dialogHandlers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: 핸들러 구현**

`src/main/ipc/dialogHandlers.ts`:

```typescript
import { ipcMain, dialog, BrowserWindow } from 'electron';

export const showConfirmCloseDialog = async (message: string): Promise<number> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showMessageBox(focusedWindow ?? new BrowserWindow(), {
    type: 'warning',
    buttons: ['저장', '저장 안 함', '취소'],
    defaultId: 0,
    cancelId: 2,
    message,
  });
  return result.response;
};

export const registerDialogHandlers = (): void => {
  ipcMain.handle('dialog:confirm-close', (_event, message: string) =>
    showConfirmCloseDialog(message),
  );
};
```

- [ ] **Step 5: main.ts에 등록**

`src/main/main.ts`에 import 추가:

```typescript
import { registerDialogHandlers } from './ipc/dialogHandlers';
```

`app.whenReady()` 안에서 호출:

```typescript
registerDialogHandlers();
```

(`registerFileHandlers()` 뒤에 배치)

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm test -- tests/main/ipc/dialogHandlers.test.ts`
Expected: PASS

- [ ] **Step 7: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 8: 커밋**

```bash
git add src/shared/types.ts src/main/ipc/dialogHandlers.ts tests/main/ipc/dialogHandlers.test.ts src/main/main.ts
git commit -m "feat(ipc): add dialog:confirm-close channel for unsaved changes warning"
```

---

### Task 4: useTabs — createNewTab, promoteTab 추가

**Files:**
- Modify: `src/renderer/hooks/useTabs.ts`
- Modify: `tests/renderer/hooks/useTabs.test.ts`

- [ ] **Step 1: createNewTab 테스트 작성**

`tests/renderer/hooks/useTabs.test.ts`에 추가:

```typescript
it('should create an untitled tab with null filePath', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.createNewTab();
  });
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.tabs[0]?.filePath).toBeNull();
  expect(result.current.tabs[0]?.fileName).toBe('Untitled');
  expect(result.current.tabs[0]?.content).toBe('');
  expect(result.current.tabs[0]?.modified).toBe(false);
  expect(result.current.activeTabId).toBe(result.current.tabs[0]?.id);
});

it('should focus existing untitled tab instead of creating duplicate', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.createNewTab();
  });
  const firstId = result.current.tabs[0]?.id;
  act(() => {
    result.current.openTab('/path/a.md', 'a.md', '# A');
  });
  // activeTab is now a.md
  expect(result.current.activeTabId).not.toBe(firstId);
  act(() => {
    result.current.createNewTab();
  });
  // should focus existing untitled tab, not create new
  expect(result.current.tabs.filter((t) => t.filePath === null)).toHaveLength(1);
  expect(result.current.activeTabId).toBe(firstId);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/renderer/hooks/useTabs.test.ts`
Expected: FAIL — `createNewTab is not a function`

- [ ] **Step 3: createNewTab 구현**

`src/renderer/hooks/useTabs.ts`에 추가:

```typescript
const createNewTab = useCallback(() => {
  setTabs((prev) => {
    const existing = prev.find((t) => t.filePath === null);
    if (existing) {
      setActiveTabId(existing.id);
      return prev;
    }
    const newTab: Tab = { id: generateId(), filePath: null, fileName: 'Untitled', content: '', modified: false };
    setActiveTabId(newTab.id);
    return [...prev, newTab];
  });
}, []);
```

return 문에 `createNewTab` 추가.

- [ ] **Step 4: createNewTab 테스트 통과 확인**

Run: `pnpm test -- tests/renderer/hooks/useTabs.test.ts`
Expected: PASS

- [ ] **Step 5: promoteTab 테스트 작성**

```typescript
it('should promote untitled tab to file tab', () => {
  const { result } = renderHook(() => useTabs());
  act(() => {
    result.current.createNewTab();
  });
  const tabId = result.current.tabs[0]?.id;
  if (!tabId) throw new Error('tab not found');
  act(() => {
    result.current.updateTabContent(tabId, '# New content');
  });
  act(() => {
    result.current.promoteTab(tabId, '/path/new-file.md', 'new-file.md');
  });
  expect(result.current.tabs[0]?.filePath).toBe('/path/new-file.md');
  expect(result.current.tabs[0]?.fileName).toBe('new-file.md');
  expect(result.current.tabs[0]?.modified).toBe(false);
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `pnpm test -- tests/renderer/hooks/useTabs.test.ts`
Expected: FAIL — `promoteTab is not a function`

- [ ] **Step 7: promoteTab 구현**

`src/renderer/hooks/useTabs.ts`에 추가:

```typescript
const promoteTab = useCallback((tabId: string, filePath: string, fileName: string) => {
  setTabs((prev) =>
    prev.map((t) => (t.id === tabId ? { ...t, filePath, fileName, modified: false } : t)),
  );
}, []);
```

return 문에 `promoteTab` 추가.

- [ ] **Step 8: 전체 테스트 통과 확인**

Run: `pnpm test -- tests/renderer/hooks/useTabs.test.ts`
Expected: PASS

- [ ] **Step 9: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 10: 커밋**

```bash
git add src/renderer/hooks/useTabs.ts tests/renderer/hooks/useTabs.test.ts
git commit -m "feat(tabs): add createNewTab and promoteTab for untitled tab lifecycle"
```

---

### Task 5: keybindings — file:new 액션 추가

**Files:**
- Modify: `src/shared/keybindings.ts`
- Modify: `tests/shared/keybindings.test.ts`

- [ ] **Step 1: 테스트 작성**

`tests/shared/keybindings.test.ts`에 추가:

```typescript
it('should include file:new in default keybindings', () => {
  const result = mergeKeybindings(undefined);
  expect(result['file:new']).toBe('CmdOrCtrl+N');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/shared/keybindings.test.ts`
Expected: FAIL — `result['file:new']` is undefined

- [ ] **Step 3: keybindings 수정**

`src/shared/keybindings.ts`:

`keybindingActions` 배열에 `'file:new'` 추가 (`'file:open'` 앞에):

```typescript
export const keybindingActions = [
  'file:new',
  'file:open',
  'file:quick-open',
  'file:save',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'help:show',
] as const;
```

`defaultKeybindings`에 추가:

```typescript
'file:new': 'CmdOrCtrl+N',
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/shared/keybindings.test.ts`
Expected: PASS

- [ ] **Step 5: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 6: 커밋**

```bash
git add src/shared/keybindings.ts tests/shared/keybindings.test.ts
git commit -m "feat(keybindings): add file:new action with CmdOrCtrl+N"
```

---

### Task 6: App.tsx — 새 탭 생성 + Save As + 닫기 확인 통합

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: useTabs에서 createNewTab, promoteTab 가져오기**

`App.tsx`의 useTabs 구조분해에 `createNewTab`, `promoteTab` 추가:

```typescript
const { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab, updateTabContent, markTabSaved, reloadTab, createNewTab, promoteTab } = useTabs();
```

- [ ] **Step 2: handleNewTab 함수 추가**

`handleSave` 위에 추가:

```typescript
const handleNewTab = useCallback(() => {
  createNewTab();
  setIsEditMode(true);
}, [createNewTab]);
```

- [ ] **Step 3: handleSave 수정 — Untitled 탭이면 Save As**

기존 `handleSave`를 수정:

```typescript
const handleSaveAs = useCallback(async () => {
  if (!activeTab) return;
  const filePath = await window.api.invoke('file:save-dialog');
  if (!filePath) return;
  await window.api.invoke('file:write', filePath, activeTab.content);
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1] ?? filePath;
  promoteTab(activeTab.id, filePath, fileName);
  void window.api.invoke('file:watch', filePath);
  await window.api.invoke('history:add', filePath);
}, [activeTab, promoteTab]);

const handleSave = useCallback(async () => {
  if (!activeTab) return;
  if (activeTab.filePath === null) {
    await handleSaveAs();
    return;
  }
  await window.api.invoke('file:write', activeTab.filePath, activeTab.content);
  markTabSaved(activeTab.id);
}, [activeTab, markTabSaved, handleSaveAs]);
```

- [ ] **Step 4: handleCloseTab 수정 — Untitled 탭 닫기 확인**

기존 `handleCloseTab`을 수정:

```typescript
const handleCloseTab = useCallback(async (tabId: string) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  // Untitled tab with content — confirm close
  if (tab.filePath === null && tab.content !== '') {
    const response = await window.api.invoke('dialog:confirm-close', '저장하지 않은 내용이 있습니다. 저장하시겠습니까?');
    if (response === 2) return; // Cancel
    if (response === 0) { // Save
      const savePath = await window.api.invoke('file:save-dialog');
      if (!savePath) return;
      await window.api.invoke('file:write', savePath, tab.content);
    }
    // response === 1: Don't save — fall through to close
  }

  // Unwatch file if it's the last tab with that filePath
  if (tab.filePath !== null) {
    const otherWithSameFile = tabs.filter((t) => t.id !== tabId && t.filePath === tab.filePath);
    if (otherWithSameFile.length === 0) {
      void window.api.invoke('file:unwatch', tab.filePath);
    }
  }

  closeTab(tabId);
}, [tabs, closeTab]);
```

- [ ] **Step 5: 키보드 단축키에 Cmd+N 추가**

`handleKeyDown` 내에 추가 (Open file 핸들러 위에):

```typescript
// New tab
if (matchAccelerator(e, kb['file:new'], isMac)) {
  e.preventDefault();
  handleNewTab();
}
```

`useEffect` 의존성 배열에 `handleNewTab` 추가.

- [ ] **Step 6: 메뉴 이벤트 리스너 추가**

기존 `menu:close-tab` useEffect 근처에 추가:

```typescript
// Menu — new file
useEffect(() => {
  const unsub = window.api.on('menu:new-file', () => {
    handleNewTab();
  });
  return unsub;
}, [handleNewTab]);

// Menu — save (already exists via keyboard, but also handle menu)
useEffect(() => {
  const unsub = window.api.on('menu:save', () => {
    void handleSave();
  });
  return unsub;
}, [handleSave]);
```

- [ ] **Step 7: MarkdownView filePath prop 수정**

`activeTab.filePath`가 null일 수 있으므로 `undefined`로 변환:

```typescript
<MarkdownView
  content={activeTab.content}
  filePath={activeTab.filePath ?? undefined}
  initialLine={topLineRef.current}
  scrollSettings={settings.scroll}
  onTopLineChange={(line) => { topLineRef.current = line; }}
/>
```

- [ ] **Step 8: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 9: 커밋**

```bash
git add src/renderer/App.tsx
git commit -m "feat(app): integrate new tab creation, save-as, and close confirmation"
```

---

### Task 7: TabBar — "+" 버튼 추가

**Files:**
- Modify: `src/renderer/components/TabBar.tsx`
- Modify: `src/renderer/styles/tabs.css`
- Modify: `src/renderer/App.tsx` (TabBar props 전달)

- [ ] **Step 1: TabBar에 onNewTab prop 추가**

`src/renderer/components/TabBar.tsx`:

```typescript
type TabBarProps = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onNewTab: () => void;
};

export const TabBar: FC<TabBarProps> = ({ tabs, activeTabId, onSelect, onClose, onNewTab }) => (
  <div className="tab-bar">
    {tabs.map((tab) => (
      <div
        key={tab.id}
        className={`tab-item ${tab.id === activeTabId ? 'tab-active' : ''}`}
        onClick={() => { onSelect(tab.id); }}
      >
        <span className="tab-title">{tab.modified ? `● ${tab.fileName}` : tab.fileName}</span>
        <button
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        >
          ×
        </button>
      </div>
    ))}
    <button className="tab-new" onClick={onNewTab}>+</button>
  </div>
);
```

- [ ] **Step 2: CSS 추가**

`src/renderer/styles/tabs.css`에 추가:

```css
.tab-new {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 18px;
  padding: 4px 12px;
  -webkit-app-region: no-drag;
}

.tab-new:hover { color: var(--color-text); }
```

- [ ] **Step 3: App.tsx에서 TabBar에 onNewTab 전달**

```typescript
<TabBar
  tabs={tabs}
  activeTabId={activeTabId}
  onSelect={setActiveTab}
  onClose={handleCloseTab}
  onNewTab={handleNewTab}
/>
```

탭이 없을 때도 TabBar를 표시하도록 조건 변경:

```typescript
<TabBar
  tabs={tabs}
  activeTabId={activeTabId}
  onSelect={setActiveTab}
  onClose={handleCloseTab}
  onNewTab={handleNewTab}
/>
```

기존 `{tabs.length > 0 && (` 조건을 제거하여 탭이 없을 때도 "+" 버튼이 보이도록 한다.

- [ ] **Step 4: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/components/TabBar.tsx src/renderer/styles/tabs.css src/renderer/App.tsx
git commit -m "feat(tabbar): add new tab button with + icon"
```

---

### Task 8: 메뉴에 New 항목 추가

**Files:**
- Modify: `src/main/menu.ts`

- [ ] **Step 1: File 메뉴에 New 항목 추가**

`src/main/menu.ts`의 File submenu 최상단에 추가:

```typescript
{
  label: 'New',
  accelerator: kb['file:new'],
  click: () => { mainWindow.webContents.send('menu:new-file'); },
},
```

`Open...` 앞에 배치하고, Open과 사이에 separator 없이 인접 배치.

- [ ] **Step 2: helpContent에 ⌘N 단축키 추가**

helpContent의 File 테이블에 추가:

```
| ⌘N | New file |
```

`| ⌘O | Open file |` 위에 배치.

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 4: 커밋**

```bash
git add src/main/menu.ts
git commit -m "feat(menu): add New item to File menu with Cmd+N accelerator"
```

---

### Task 9: E2E 테스트

**Files:**
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: E2E 테스트 작성**

`tests/e2e/app.spec.ts`에 추가:

```typescript
test('should create new untitled tab with Cmd+N', async () => {
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Press Cmd+N to create new tab
  await page.keyboard.press('Meta+n');

  // Tab bar should show with "Untitled" tab
  const tabTitle = await page.locator('.tab-title').first().textContent();
  expect(tabTitle).toBe('Untitled');

  // Should be in edit mode (CodeMirror editor visible)
  await expect(page.locator('.cm-editor')).toBeVisible();

  // Mode indicator should show "Edit"
  const modeText = await page.locator('.mode-indicator').textContent();
  expect(modeText).toContain('Edit');

  await app.close();
});

test('should show + button in tab bar', async () => {
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // "+" button should be visible
  await expect(page.locator('.tab-new')).toBeVisible();

  // Click it
  await page.locator('.tab-new').click();

  // Should create untitled tab
  const tabTitle = await page.locator('.tab-title').first().textContent();
  expect(tabTitle).toBe('Untitled');

  await app.close();
});
```

- [ ] **Step 2: 빌드 후 E2E 실행**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add tests/e2e/app.spec.ts
git commit -m "test(e2e): add new untitled tab creation tests"
```

---

### Task 10: 최종 빌드 검증

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 위반 0건

- [ ] **Step 3: E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 4: 앱 빌드**

Run: `pnpm run build:app`
Expected: 빌드 성공
