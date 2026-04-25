import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabs } from '../../../src/renderer/hooks/useTabs';

describe('useTabs', () => {
  it('should start with no tabs', () => {
    const { result } = renderHook(() => useTabs());
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
  });

  it('should add a tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/file.md', 'file.md', '# Hello');
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.fileName).toBe('file.md');
    expect(result.current.activeTabId).toBe(result.current.tabs[0]?.id);
  });

  it('should not duplicate tab for same file', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/file.md', 'file.md', '# Hello');
      result.current.openTab('/path/file.md', 'file.md', '# Hello');
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('should close a tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# A');
      result.current.openTab('/path/b.md', 'b.md', '# B');
    });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.closeTab(tabId);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.fileName).toBe('b.md');
  });

  it('should switch active tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# A');
      result.current.openTab('/path/b.md', 'b.md', '# B');
    });
    const firstTabId = result.current.tabs[0]?.id;
    if (!firstTabId) throw new Error('tab not found');
    act(() => {
      result.current.setActiveTab(firstTabId);
    });
    expect(result.current.activeTabId).toBe(firstTabId);
  });

  it('should activate adjacent tab when closing active tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# A');
      result.current.openTab('/path/b.md', 'b.md', '# B');
    });
    const activeId = result.current.activeTabId;
    if (!activeId) throw new Error('no active tab');
    act(() => {
      result.current.closeTab(activeId);
    });
    expect(result.current.activeTabId).not.toBeNull();
  });

  it('should reload tab content when tab is not modified', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# Original');
    });
    act(() => {
      result.current.reloadTab('/path/a.md', '# Updated');
    });
    expect(result.current.tabs[0]?.content).toBe('# Updated');
  });

  it('should not reload tab content when tab is modified', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# Original');
    });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.updateTabContent(tabId, '# User edit');
    });
    act(() => {
      result.current.reloadTab('/path/a.md', '# External change');
    });
    expect(result.current.tabs[0]?.content).toBe('# User edit');
  });

  it('should not reload tab when filePath does not match', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# Original');
    });
    act(() => {
      result.current.reloadTab('/path/b.md', '# Updated');
    });
    expect(result.current.tabs[0]?.content).toBe('# Original');
  });

  it('should force reload tab even when modified', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# Original');
    });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.updateTabContent(tabId, '# User edit');
    });
    expect(result.current.tabs[0]?.modified).toBe(true);
    act(() => {
      result.current.forceReloadTab('/path/a.md', '# External change');
    });
    expect(result.current.tabs[0]?.content).toBe('# External change');
    expect(result.current.tabs[0]?.modified).toBe(false);
  });

  it('should return null activeTabId when all tabs closed', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTab('/path/a.md', 'a.md', '# A');
    });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.closeTab(tabId);
    });
    expect(result.current.activeTabId).toBeNull();
    expect(result.current.tabs).toHaveLength(0);
  });

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
});

describe('useTabs.navigateTab', () => {
  it('pushes a new history entry and advances historyIndex', () => {
    const { result } = renderHook(() => useTabs());
    act(() => { result.current.openTab('/a.md', 'a.md', '# A'); });
    const tabId = result.current.tabs[0]?.id;
    if (!tabId) throw new Error('tab not found');
    act(() => {
      result.current.navigateTab(
        tabId,
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
      result.current.navigateTab(
        tabId,
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
      result.current.navigateTab(
        tabId,
        { filePath: '/b.md', fileName: 'b.md', content: '# B' },
        0,
      );
    });
    expect(result.current.tabs[0]?.filePath).toBeNull();
    expect(result.current.tabs[0]?.history).toEqual([]);
    expect(result.current.tabs[0]?.historyIndex).toBe(-1);
  });
});
