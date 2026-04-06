import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
