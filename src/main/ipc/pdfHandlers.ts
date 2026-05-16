import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { derivePdfName } from './pdfName';

const PRINT_READY_TIMEOUT_MS = 15_000;

let resolvePrintReady: (() => void) | null = null;

const createPrintWindow = (): BrowserWindow =>
  new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

const loadPrintEntry = async (
  win: BrowserWindow,
  filePath: string,
): Promise<void> => {
  const hash = `print?path=${encodeURIComponent(filePath)}`;
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    await win.loadURL(`${devUrl}#${hash}`);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }
};

export const registerPdfHandlers = (): void => {
  ipcMain.handle('pdf:print-ready', () => {
    resolvePrintReady?.();
  });

  ipcMain.handle('pdf:export', async (_event, filePath: string) => {
    const focused = BrowserWindow.getFocusedWindow();
    const options = {
      defaultPath: join(dirname(filePath), derivePdfName(filePath)),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    };
    const result = focused
      ? await dialog.showSaveDialog(focused, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { ok: false as const, reason: 'canceled' };
    }
    const target = result.filePath;

    const printWin = createPrintWindow();
    const ready = new Promise<void>((resolve, reject) => {
      resolvePrintReady = resolve;
      setTimeout(
        () => { reject(new Error('PDF render timed out')); },
        PRINT_READY_TIMEOUT_MS,
      );
    });

    try {
      await loadPrintEntry(printWin, filePath);
      await ready;
      const pdf = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await writeFile(target, pdf);
      return { ok: true as const, path: target };
    } catch (err) {
      dialog.showErrorBox(
        'PDF Export Failed',
        err instanceof Error ? err.message : String(err),
      );
      return { ok: false as const, reason: 'failed' };
    } finally {
      resolvePrintReady = null;
      if (!printWin.isDestroyed()) printWin.destroy();
    }
  });
};
