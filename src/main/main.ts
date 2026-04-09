import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'path';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerHistoryHandlers } from './ipc/historyHandlers';
import { registerThemeHandlers } from './ipc/themeHandlers';
import { getSettings, registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerFileWatchHandlers } from './ipc/fileWatchHandlers';
import { registerDialogHandlers } from './ipc/dialogHandlers';
import { registerImageProtocol } from './protocol';
import { createMenu } from './menu';
import { createOpenFileQueue } from './openFileQueue';

const openFileQueue = createOpenFileQueue();

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
  registerImageProtocol();
  registerFileHandlers();
  registerThemeHandlers();
  registerHistoryHandlers();
  registerSettingsHandlers();
  registerDialogHandlers();
  const fileWatcher = registerFileWatchHandlers();
  const mainWindow = createWindow();
  const settings = getSettings();
  const menu = createMenu(mainWindow, settings);
  Menu.setApplicationMenu(menu);

  const fileArg = process.argv.find((arg) => arg.endsWith('.md') || arg.endsWith('.markdown'));
  if (fileArg) {
    openFileQueue.enqueue(fileArg);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    openFileQueue.setSender((filePath) => {
      mainWindow.webContents.send('app:open-file', filePath);
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    fileWatcher.cleanup();
    if (process.platform !== 'darwin') app.quit();
  });
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openFileQueue.enqueue(filePath);
});
