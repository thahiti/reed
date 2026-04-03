import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuickOpen } from '../../../src/renderer/hooks/useQuickOpen';
import type { HistoryEntry } from '../../../src/shared/types';

const mockEntries: ReadonlyArray<HistoryEntry> = [
  { filePath: '/docs/readme.md', fileName: 'readme.md', openedAt: '2026-04-03T10:00:00Z' },
  { filePath: '/docs/guide.md', fileName: 'guide.md', openedAt: '2026-04-03T09:00:00Z' },
  { filePath: '/notes/todo.md', fileName: 'todo.md', openedAt: '2026-04-03T08:00:00Z' },
];

const mockInvoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(mockEntries);
  Object.defineProperty(window, 'api', {
    value: { invoke: mockInvoke, on: vi.fn() },
    writable: true,
  });
});

describe('useQuickOpen', () => {
  it('should load history entries', async () => {
    const { result } = renderHook(() => useQuickOpen());
    await act(async () => {
      await result.current.loadHistory();
    });
    expect(result.current.entries).toHaveLength(3);
    expect(result.current.entries[0]?.fileName).toBe('readme.md');
  });

  it('should filter entries by search query', async () => {
    const { result } = renderHook(() => useQuickOpen());
    await act(async () => {
      await result.current.loadHistory();
    });
    act(() => {
      result.current.setQuery('guide');
    });
    expect(result.current.filteredEntries).toHaveLength(1);
    expect(result.current.filteredEntries[0]?.fileName).toBe('guide.md');
  });

  it('should return all entries when query is empty', async () => {
    const { result } = renderHook(() => useQuickOpen());
    await act(async () => {
      await result.current.loadHistory();
    });
    expect(result.current.filteredEntries).toHaveLength(3);
  });
});
