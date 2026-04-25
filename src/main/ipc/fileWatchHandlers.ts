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
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const notifyRenderer = (filePath: string): void => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('file:changed', filePath);
    });
  };

  const scheduleNotify = (filePath: string): void => {
    const existing = debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      filePath,
      setTimeout(() => {
        debounceTimers.delete(filePath);
        if (existsSync(filePath)) {
          notifyRenderer(filePath);
        }
      }, 300)
    );
  };

  const startWatcher = (filePath: string): void => {
    if (!existsSync(filePath)) return;
    const fsWatcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        scheduleNotify(filePath);
        return;
      }
      // eventType === 'rename'.
      // Atomic save (write tmp + rename onto target) replaces the inode, so
      // the original watcher is dead. Close it, give the rename a brief moment
      // to settle, then re-attach to the same path. Notify the renderer so it
      // re-reads, since rename-onto means content changed.
      fsWatcher.close();
      watchers.delete(filePath);
      setTimeout(() => {
        if (existsSync(filePath)) {
          startWatcher(filePath);
          notifyRenderer(filePath);
        }
      }, 100);
    });
    watchers.set(filePath, fsWatcher);
  };

  const watchFile = (filePath: string): void => {
    if (watchers.has(filePath)) return;
    startWatcher(filePath);
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
    watchers.forEach((w) => { w.close(); });
    watchers.clear();
    debounceTimers.forEach((t) => { clearTimeout(t); });
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

export const registerFileWatchHandlers = (): FileWatcher => {
  const watcher = createFileWatcher();

  ipcMain.handle('file:watch', (_event, filePath: string) => {
    watcher.watch(filePath);
  });

  ipcMain.handle('file:unwatch', (_event, filePath: string) => {
    watcher.unwatch(filePath);
  });

  return watcher;
};
