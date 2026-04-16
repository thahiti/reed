import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('Vim-style Search', () => {
  const testFile = resolve(__dirname, '../../test-search.md');
  const testContent = '# Search Test\n\nThe cat and the dog and the bird.\n\nAnother paragraph with the word here.';

  test.beforeEach(() => {
    writeFileSync(testFile, testContent);
  });

  test.afterEach(() => {
    try { unlinkSync(testFile); } catch { /* file may not exist */ }
  });

  test('should open search bar with / key and show matches', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.markdown-content')).toBeVisible();

    // Press / to open search
    await page.keyboard.press('/');
    await expect(page.locator('.search-bar')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.search-bar-input')).toBeFocused();

    // Type search query
    await page.keyboard.type('the');

    // Should show highlights
    await expect(page.locator('mark.search-highlight').first()).toBeVisible({ timeout: 2000 });
    const highlightCount = await page.locator('mark.search-highlight').count();
    expect(highlightCount).toBeGreaterThanOrEqual(4); // "the" appears at least 4 times

    // Should show match count
    await expect(page.locator('.search-bar-count')).toBeVisible();

    await app.close();
  });

  test('should confirm search with Enter and navigate with n/N', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

    // Open search and type query
    await page.keyboard.press('/');
    await expect(page.locator('.search-bar-input')).toBeFocused({ timeout: 2000 });
    await page.keyboard.type('the');

    // Confirm with Enter — should switch to confirmed mode (indicator)
    await page.locator('.search-bar-input').press('Enter');

    // Search bar should switch to confirmed mode (no input, shows query text)
    await expect(page.locator('.search-bar-confirmed')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.search-bar-query')).toBeVisible();

    // Highlights should still be visible
    const highlightCount = await page.locator('mark.search-highlight').count();
    expect(highlightCount).toBeGreaterThanOrEqual(4);

    // Active highlight should exist
    await expect(page.locator('mark.search-highlight-active')).toBeVisible();

    // Press n to go to next match
    await page.keyboard.press('n');
    // Count text should update (we just verify it's still visible)
    await expect(page.locator('.search-bar-count')).toBeVisible();

    // Press N (Shift+n) to go to previous match
    await page.keyboard.press('Shift+n');
    await expect(page.locator('.search-bar-count')).toBeVisible();

    await app.close();
  });

  test('should clear search with Escape', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

    // Open search, type, confirm
    await page.keyboard.press('/');
    await expect(page.locator('.search-bar-input')).toBeFocused({ timeout: 2000 });
    await page.keyboard.type('the');
    await page.locator('.search-bar-input').press('Enter');
    await expect(page.locator('.search-bar-confirmed')).toBeVisible({ timeout: 2000 });

    // Press Escape to clear search
    await page.keyboard.press('Escape');

    // Search bar and highlights should be gone
    await expect(page.locator('.search-bar')).not.toBeVisible({ timeout: 2000 });
    const highlightCount = await page.locator('mark.search-highlight').count();
    expect(highlightCount).toBe(0);

    await app.close();
  });

  test('should cancel search with Escape during input', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

    // Open search and type
    await page.keyboard.press('/');
    await page.keyboard.type('the');

    // Press Escape without confirming
    await page.keyboard.press('Escape');

    // Search bar and highlights should be gone
    await expect(page.locator('.search-bar')).not.toBeVisible({ timeout: 2000 });
    const highlightCount = await page.locator('mark.search-highlight').count();
    expect(highlightCount).toBe(0);

    await app.close();
  });
});
