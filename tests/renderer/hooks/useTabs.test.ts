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
});
