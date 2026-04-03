import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('MDViewer E2E', () => {
  test('should launch and show welcome screen', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const title = await page.locator('.welcome-title').textContent();
    expect(title).toBe('MDViewer');

    const subtitle = await page.locator('.welcome-subtitle').textContent();
    expect(subtitle).toContain('마크다운');

    await app.close();
  });

  test('should have correct window title', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const windowTitle = await page.title();
    expect(windowTitle).toBe('MDViewer');

    await app.close();
  });

  test('should show no tabs initially', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const tabBar = await page.locator('.tab-bar').count();
    expect(tabBar).toBe(0);

    await app.close();
  });

  test('should open file via IPC and render markdown', async () => {
    const testFile = resolve(__dirname, '../../test-fixture.md');
    writeFileSync(testFile, '# Test Heading\n\nHello from E2E test.');

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      // Simulate file open via main process IPC
      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      // Wait for tab to appear
      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.tab-title')).toHaveText('test-fixture.md');

      // Verify markdown rendered
      await expect(page.locator('.markdown-content')).toBeVisible();

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });
});
