import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';

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
});
