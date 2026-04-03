import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export const readFileContent = async (filePath: string): Promise<string> =>
  readFile(filePath, 'utf-8');

export const resolveRelativePath = (basePath: string, relativePath: string): string => {
  const baseDir = dirname(basePath);
  const resolved = resolve(baseDir, relativePath);

  // Determine the top-level ancestor of the base directory to use as security boundary.
  // e.g. for /docs/sub, the boundary is /docs (the direct child of root).
  const parts = baseDir.split('/').filter(Boolean);
  const firstPart = parts[0];
  const boundary = firstPart !== undefined ? `/${firstPart}` : '/';

  if (!resolved.startsWith(boundary)) {
    throw new Error(`Path traversal detected: ${relativePath}`);
  }

  return resolved;
};

export const registerFileHandlers = (): void => {
  ipcMain.handle('file:read', (_event, filePath: string) =>
    readFileContent(filePath),
  );

  ipcMain.handle('file:open-dialog', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow ?? new BrowserWindow(), {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(
    'file:resolve-path',
    (_event, basePath: string, relativePath: string) =>
      resolveRelativePath(basePath, relativePath),
  );

  ipcMain.handle('file:open-external', (_event, url: string) =>
    shell.openExternal(url),
  );

  ipcMain.handle('file:write', (_event, filePath: string, content: string) =>
    writeFile(filePath, content, 'utf-8'),
  );
};
