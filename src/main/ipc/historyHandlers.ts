import { ipcMain } from 'electron';
import Store from 'electron-store';
import { basename } from 'node:path';
import type { HistoryEntry } from '../../shared/types';

type StoreSchema = { history: ReadonlyArray<HistoryEntry> };

const store = new Store<StoreSchema>({
  defaults: { history: [] },
});

const MAX_HISTORY = 100;

export const registerHistoryHandlers = (): void => {
  ipcMain.handle('history:get', () => {
    const history = store.get('history', []);
    return [...history].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  });

  ipcMain.handle('history:add', (_event, filePath: string) => {
    const history = store.get('history', []);
    const filtered = history.filter((e) => e.filePath !== filePath);
    const entry: HistoryEntry = {
      filePath,
      fileName: basename(filePath),
      openedAt: new Date().toISOString(),
    };
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    store.set('history', updated);
  });
};
