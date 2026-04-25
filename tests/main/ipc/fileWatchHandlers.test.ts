import { describe, it, expect, vi, beforeEach } from 'vitest';

type WatchListener = (eventType: string) => void;

const sentChannels: { channel: string; payload: unknown }[] = [];
const send = vi.fn((channel: string, payload: unknown) => {
  sentChannels.push({ channel, payload });
});

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => [{ webContents: { send } }]) },
}));

const watchListeners = new Map<string, WatchListener[]>();
const watchClose = vi.fn();
const existsSyncMock = vi.fn(() => true);

vi.mock('node:fs', () => ({
  watch: vi.fn((path: string, listener: WatchListener) => {
    const list = watchListeners.get(path) ?? [];
    list.push(listener);
    watchListeners.set(path, list);
    return { close: watchClose };
  }),
  existsSync: (p: string) => existsSyncMock(p),
}));

import { createFileWatcher } from '../../../src/main/ipc/fileWatchHandlers';

const fireEvent = (path: string, eventType: string): void => {
  const list = watchListeners.get(path) ?? [];
  list.forEach((cb) => { cb(eventType); });
};

describe('fileWatchHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    watchListeners.clear();
    sentChannels.length = 0;
    existsSyncMock.mockImplementation(() => true);
  });

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

  it('debounces and notifies renderer on change events', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');
    fireEvent('/test/file.md', 'change');
    fireEvent('/test/file.md', 'change');
    expect(sentChannels).toHaveLength(0);
    vi.advanceTimersByTime(310);
    expect(sentChannels).toEqual([{ channel: 'file:changed', payload: '/test/file.md' }]);
  });

  it('on rename: closes current watcher, re-establishes after delay, and notifies renderer', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');
    expect(watcher.isWatching('/test/file.md')).toBe(true);
    expect(watchClose).not.toHaveBeenCalled();

    fireEvent('/test/file.md', 'rename');
    expect(watchClose).toHaveBeenCalledTimes(1);
    // Watcher gone briefly
    expect(watcher.isWatching('/test/file.md')).toBe(false);
    expect(sentChannels).toHaveLength(0);

    vi.advanceTimersByTime(110);
    // Re-attached at the same path
    expect(watcher.isWatching('/test/file.md')).toBe(true);
    // Renderer notified that content changed
    expect(sentChannels).toEqual([{ channel: 'file:changed', payload: '/test/file.md' }]);
  });

  it('on rename: drops watcher when file no longer exists after delay', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');

    existsSyncMock.mockImplementation(() => false);
    fireEvent('/test/file.md', 'rename');
    vi.advanceTimersByTime(110);

    expect(watcher.isWatching('/test/file.md')).toBe(false);
    expect(sentChannels).toHaveLength(0);
  });

  it('after re-watch, subsequent change events still trigger notify', () => {
    const watcher = createFileWatcher();
    watcher.watch('/test/file.md');

    fireEvent('/test/file.md', 'rename');
    vi.advanceTimersByTime(110);
    sentChannels.length = 0;

    fireEvent('/test/file.md', 'change');
    vi.advanceTimersByTime(310);
    expect(sentChannels).toEqual([{ channel: 'file:changed', payload: '/test/file.md' }]);
  });
});
