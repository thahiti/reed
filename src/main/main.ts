import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'path';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerHistoryHandlers } from './ipc/historyHandlers';
import { registerThemeHandlers } from './ipc/themeHandlers';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { createMenu } from './menu';

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
};

void app.whenReady().then(() => {
  registerFileHandlers();
  registerThemeHandlers();
  registerHistoryHandlers();
  registerSettingsHandlers();
  const mainWindow = createWindow();
  const menu = createMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  const fileArg = process.argv.find((arg) => arg.endsWith('.md') || arg.endsWith('.markdown'));
  if (fileArg) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('app:open-file', fileArg);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('app:open-file', filePath);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
