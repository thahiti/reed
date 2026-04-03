import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

export const createMenu = (mainWindow: BrowserWindow): Menu => {
  const template: ReadonlyArray<MenuItemConstructorOptions> = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'Cmd+O',
          click: () => { mainWindow.webContents.send('menu:open-file'); },
        },
        {
          label: 'Quick Open',
          accelerator: 'Cmd+P',
          click: () => { mainWindow.webContents.send('menu:quick-open'); },
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'Cmd+W',
          click: () => { mainWindow.webContents.send('menu:close-tab'); },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ];

  return Menu.buildFromTemplate([...template]);
};
