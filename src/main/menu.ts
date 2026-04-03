import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

const helpContent = `
# Reed — Keyboard Shortcuts

## File
| Shortcut | Action |
|----------|--------|
| ⌘O | Open file |
| ⌘P | Quick Open (recent files) |
| ⌘S | Save file |
| ⌘W | Close tab |

## Edit Mode
| Shortcut | Action |
|----------|--------|
| T | Toggle Read / Edit mode |
| Escape | Exit Edit mode |
| ⌘Z | Undo |
| ⇧⌘Z | Redo |
| ⌘A | Select All |
| ⌘C | Copy |
| ⌘V | Paste |
| ⌘X | Cut |

## Tabs
| Shortcut | Action |
|----------|--------|
| ⌘1–9 | Switch to tab N |
| ⇧⌘[ | Previous tab |
| ⇧⌘] | Next tab |

## View
| Shortcut | Action |
|----------|--------|
| ⌘+ | Zoom in |
| ⌘- | Zoom out |
| ⌘0 | Reset zoom |
| ⌃⌘F | Toggle fullscreen |

## Other
- Drag & drop .md files onto the window to open
- Double-click .md files in Finder to open with Reed
`.trim();

const showHelp = (mainWindow: BrowserWindow): void => {
  mainWindow.webContents.send('app:open-help', helpContent);
};

export const createMenu = (mainWindow: BrowserWindow): Menu => {
  const template: ReadonlyArray<MenuItemConstructorOptions> = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
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
          label: 'Save',
          accelerator: 'Cmd+S',
          click: () => { mainWindow.webContents.send('menu:save'); },
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'Cmd+W',
          click: () => { mainWindow.webContents.send('menu:close-tab'); },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Edit Mode',
          accelerator: 'T',
          click: () => { mainWindow.webContents.send('menu:toggle-edit'); },
          registerAccelerator: false,
        },
        { type: 'separator' },
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
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Reed Help',
          click: () => { showHelp(mainWindow); },
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Cmd+/',
          click: () => { showHelp(mainWindow); },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate([...template]);
};
