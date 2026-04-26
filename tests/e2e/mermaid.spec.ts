import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('Mermaid rendering E2E', () => {
  test('should render valid mermaid block as SVG', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-mermaid.md');
    writeFileSync(
      testFile,
      '# Diagram\n\n```mermaid\ngraph TD;\nA-->B;\nB-->C;\n```\n',
    );

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      const diagram = page.locator('[data-testid="mermaid-diagram"][data-state="ready"]');
      await expect(diagram).toBeVisible({ timeout: 5000 });
      await expect(diagram.locator('svg')).toBeVisible();

      await app.close();
    } finally {
      try { unlinkSync(testFile); } catch { /* */ }
    }
  });

  test('should render error fallback for invalid mermaid syntax', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-mermaid-bad.md');
    writeFileSync(
      testFile,
      '# Bad Diagram\n\n```mermaid\nflowchart\n  A --bad-> B\n```\n',
    );

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      const errorBox = page.locator('[data-testid="mermaid-error"]');
      await expect(errorBox).toBeVisible({ timeout: 5000 });
      await expect(errorBox).toContainText('A --bad-> B');

      await app.close();
    } finally {
      try { unlinkSync(testFile); } catch { /* */ }
    }
  });
});
