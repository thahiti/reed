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
let mainWindow: BrowserWindow | null = null;
let rebuildMenu: (() => void) | null = null;

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
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
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.webContents.on('did-finish-load', () => {
    void win.webContents.setVisualZoomLevelLimits(1, 5);
    openFileQueue.setSender((filePath) => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:open-file', filePath);
      }
    });
  });

  win.on('closed', () => {
    openFileQueue.resetSender();
    if (mainWindow === win) mainWindow = null;
  });

  return win;
};

const ensureMainWindow = (): BrowserWindow => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  mainWindow = createWindow();
  rebuildMenu?.();
  return mainWindow;
};

void app.whenReady().then(() => {
  registerImageProtocol();
  registerFileHandlers();
  registerThemeHandlers();
  registerHistoryHandlers();
  registerDialogHandlers();
  const fileWatcher = registerFileWatchHandlers();

  mainWindow = createWindow();

  rebuildMenu = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const menu = createMenu(mainWindow, getSettings());
    Menu.setApplicationMenu(menu);
  };

  registerSettingsHandlers(rebuildMenu);
  rebuildMenu();

  const fileArg = process.argv.find((arg) => arg.endsWith('.md') || arg.endsWith('.markdown'));
  if (fileArg) {
    openFileQueue.enqueue(fileArg);
  }

  app.on('activate', () => {
    ensureMainWindow();
  });

  app.on('window-all-closed', () => {
    fileWatcher.cleanup();
    if (process.platform !== 'darwin') app.quit();
  });
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openFileQueue.enqueue(filePath);
  if (app.isReady()) {
    ensureMainWindow();
  }
});
