import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import type { AppSettings } from '../../shared/types';

const defaultSettings: AppSettings = {
  scroll: {
    stepLines: 8,
    pageLines: 30,
  },
};

const store = new Store<{ settings: AppSettings }>({
  defaults: { settings: defaultSettings },
});

export const getSettingsPath = (): string => store.path;

export const getSettings = (): AppSettings => ({
  ...defaultSettings,
  ...store.get('settings', defaultSettings),
});

export const registerSettingsHandlers = (): void => {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_event, settings: AppSettings) => {
    store.set('settings', settings);
  });

  ipcMain.handle('settings:open-file', () => {
    void shell.openPath(store.path);
  });
};
