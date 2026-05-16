import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('PDF export E2E', () => {
  test('exports the active tab to a PDF file', async () => {
    const mdFile = resolve(__dirname, '../../test-fixture-pdf.md');
    const outPdf = resolve(tmpdir(), `reed-export-${String(Date.now())}.pdf`);
    writeFileSync(mdFile, '# PDF Title\n\nHello **world**.\n');

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ dialog }, filePath) => {
        // Stub the save dialog to a fixed temp path.
        dialog.showSaveDialog = (() =>
          Promise.resolve({
            canceled: false,
            filePath,
          })) as typeof dialog.showSaveDialog;
      }, outPdf);

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, mdFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('menu:export-pdf');
      });

      await expect
        .poll(() => existsSync(outPdf), { timeout: 20000 })
        .toBe(true);
      expect(statSync(outPdf).size).toBeGreaterThan(0);

      await app.close();
    } finally {
      try { unlinkSync(mdFile); } catch { /* */ }
      try { unlinkSync(outPdf); } catch { /* */ }
    }
  });
});
