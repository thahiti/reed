import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { getSettingsPath } from './ipc/settingsHandlers';
import { mergeKeybindings } from '../shared/keybindings';
import { bodyFonts, codeFonts, defaultBodyFontId, defaultCodeFontId } from '../shared/fonts';
import type { AppSettings } from '../shared/types';

const helpContent = `
# Reed — Keyboard Shortcuts

## File
| Shortcut | Action |
|----------|--------|
| ⌘N | New file |
| ⌘O | Open file |
| ⌘P | Quick Open (recent files) |
| ⌘S | Save file |
| C | Copy current file path |
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
| ⌃, | Previous tab |
| ⌃. | Next tab |

## Navigation (Read Mode)
| Shortcut | Action |
|----------|--------|
| j | Scroll down |
| k | Scroll up |
| d | Page down |
| u | Page up |
| G | Go to end |
| gg | Go to top |

## View
| Shortcut | Action |
|----------|--------|
| ⌘+ | Zoom in |
| ⌘- | Zoom out |
| ⌘0 | Reset zoom |
| ⌃⌘F | Toggle fullscreen |

## Settings
- **⌘,** — Open settings file (JSON)
- Scroll speed, fonts, colors can be customized
- Settings are stored in the app's config directory

### Example settings
\`\`\`json
{
  "settings": {
    "scroll": {
      "stepLines": 8,
      "pageLines": 30
    },
    "lightTheme": {
      "fonts": { "body": "Georgia, serif", "bodySize": "18px" },
      "colors": { "bg": "#fefefe", "text": "#333" }
    },
    "darkTheme": {
      "colors": { "bg": "#1a1a1a" }
    }
  }
}
\`\`\`

### Keybindings

All keyboard shortcuts can be customized in settings:

\`\`\`json
{
  "settings": {
    "keybindings": {
      "file:open": "CmdOrCtrl+O",
      "file:quick-open": "CmdOrCtrl+P",
      "file:save": "CmdOrCtrl+S",
      "file:copy-path": "C",
      "tab:close": "CmdOrCtrl+W",
      "tab:prev": "Ctrl+,",
      "tab:next": "Ctrl+.",
      "view:toggle-edit": "T",
      "view:toggle-toc": "O",
      "help:show": "CmdOrCtrl+/"
    }
  }
}
\`\`\`

## Fonts
- **View > Body Font** — Choose body text font (SUIT, Pretendard, Noto Serif KR, KoPub Batang)
- **View > Code Font** — Choose code font (JetBrains Mono, D2Coding, Nanum Gothic Coding)

## Other
- Drag & drop .md files onto the window to open
- Double-click .md files in Finder to open with Reed
`.trim();

const showHelp = (mainWindow: BrowserWindow): void => {
  mainWindow.webContents.send('app:open-help', helpContent);
};

export const createMenu = (mainWindow: BrowserWindow, settings: AppSettings): Menu => {
  const kb = mergeKeybindings(settings.keybindings);
  const template: ReadonlyArray<MenuItemConstructorOptions> = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: () => { void shell.openPath(getSettingsPath()); },
        },
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
          label: 'New',
          accelerator: kb['file:new'],
          click: () => { mainWindow.webContents.send('menu:new-file'); },
        },
        {
          label: 'Open...',
          accelerator: kb['file:open'],
          click: () => { mainWindow.webContents.send('menu:open-file'); },
        },
        {
          label: 'Quick Open',
          accelerator: kb['file:quick-open'],
          click: () => { mainWindow.webContents.send('menu:quick-open'); },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: kb['file:save'],
          click: () => { mainWindow.webContents.send('menu:save'); },
        },
        { type: 'separator' },
        {
          label: 'Copy File Path',
          accelerator: kb['file:copy-path'],
          click: () => { mainWindow.webContents.send('menu:copy-file-path'); },
          registerAccelerator: false,
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: kb['tab:close'],
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
          accelerator: kb['view:toggle-edit'],
          click: () => { mainWindow.webContents.send('menu:toggle-edit'); },
          registerAccelerator: false,
        },
        {
          label: 'Toggle Outline',
          accelerator: kb['view:toggle-toc'],
          click: () => { mainWindow.webContents.send('menu:toggle-toc'); },
          registerAccelerator: false,
        },
        { type: 'separator' },
        {
          label: 'Body Font',
          submenu: bodyFonts.map((font) => ({
            label: font.name,
            type: 'radio' as const,
            checked: (settings.bodyFont ?? defaultBodyFontId) === font.id,
            click: () => { mainWindow.webContents.send('menu:set-body-font', font.id); },
          })),
        },
        {
          label: 'Code Font',
          submenu: codeFonts.map((font) => ({
            label: font.name,
            type: 'radio' as const,
            checked: (settings.codeFont ?? defaultCodeFontId) === font.id,
            click: () => { mainWindow.webContents.send('menu:set-code-font', font.id); },
          })),
        },
        { type: 'separator' },
        {
          label: 'Previous Tab',
          accelerator: kb['tab:prev'],
          click: () => { mainWindow.webContents.send('menu:prev-tab'); },
        },
        {
          label: 'Next Tab',
          accelerator: kb['tab:next'],
          click: () => { mainWindow.webContents.send('menu:next-tab'); },
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
          accelerator: kb['help:show'],
          click: () => { showHelp(mainWindow); },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate([...template]);
};
