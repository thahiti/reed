import { ipcMain, nativeTheme, BrowserWindow } from 'electron';

export const registerThemeHandlers = (): void => {
  ipcMain.handle('theme:get-system', () =>
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  );

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:on-change', theme);
    });
  });
};
