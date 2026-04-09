import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

test.describe('Reed E2E', () => {
  test('should launch and show welcome screen', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const title = await page.locator('.welcome-title').textContent();
    expect(title).toBe('Reed');

    const subtitle = await page.locator('.welcome-subtitle').textContent();
    expect(subtitle).toContain('마크다운');

    await app.close();
  });

  test('should have correct window title', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    const windowTitle = await page.title();
    expect(windowTitle).toBe('Reed');

    await app.close();
  });

  test('should show tab bar with no tabs initially', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    // Tab bar is always rendered (even with no tabs open)
    await expect(page.locator('.tab-bar')).toBeVisible();
    const tabItems = await page.locator('.tab-item').count();
    expect(tabItems).toBe(0);

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

  test('should render image with md-image protocol for local paths', async () => {
    const fixtureDir = resolve(__dirname, '../../test-fixture-img');
    const imagesDir = resolve(fixtureDir, 'images');
    mkdirSync(imagesDir, { recursive: true });

    const testFile = resolve(fixtureDir, 'readme.md');
    writeFileSync(testFile, '![diagram](images/test.png)\n\n![external](https://example.com/pic.png)');
    // Create a minimal 1x1 PNG
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    writeFileSync(resolve(imagesDir, 'test.png'), pngBuffer);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      // Verify local image uses md-image protocol
      const localImg = page.locator('.markdown-content img').first();
      await expect(localImg).toBeVisible({ timeout: 5000 });
      const localSrc = await localImg.getAttribute('src');
      expect(localSrc).toContain('md-image://');
      expect(localSrc).toContain('images/test.png');

      // Verify external image URL is preserved
      const externalImg = page.locator('.markdown-content img').nth(1);
      await expect(externalImg).toBeVisible({ timeout: 5000 });
      const externalSrc = await externalImg.getAttribute('src');
      expect(externalSrc).toBe('https://example.com/pic.png');

      await app.close();
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('should auto-reload when file is modified externally', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-reload.md');
    writeFileSync(testFile, '# Original Content');

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      // Open the file
      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.markdown-content h1')).toHaveText('Original Content');

      // Modify file externally
      writeFileSync(testFile, '# Updated Content');

      // Wait for auto-reload (debounce 300ms + some buffer)
      await expect(page.locator('.markdown-content h1')).toHaveText('Updated Content', {
        timeout: 5000,
      });

      await app.close();
    } finally {
      try {
        unlinkSync(testFile);
      } catch {
        /* file may not exist */
      }
    }
  });

  test('should create new untitled tab with Cmd+N', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Press Cmd+N to create new tab
    await page.keyboard.press('Meta+n');

    // Tab bar should show with "Untitled" tab
    const tabTitle = await page.locator('.tab-title').first().textContent();
    expect(tabTitle).toBe('Untitled');

    // Should be in edit mode (CodeMirror editor visible)
    await expect(page.locator('.cm-editor')).toBeVisible();

    // Mode indicator should show "Edit"
    const modeText = await page.locator('.mode-indicator').textContent();
    expect(modeText).toContain('Edit');

    await app.close();
  });

  test('should show + button in tab bar', async () => {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // "+" button should be visible
    await expect(page.locator('.tab-new')).toBeVisible();

    // Click it
    await page.locator('.tab-new').click();

    // Should create untitled tab
    const tabTitle = await page.locator('.tab-title').first().textContent();
    expect(tabTitle).toBe('Untitled');

    await app.close();
  });

  test('should navigate tabs with menu events', async () => {
    const testFile1 = resolve(__dirname, '../../test-tab1.md');
    const testFile2 = resolve(__dirname, '../../test-tab2.md');
    writeFileSync(testFile1, '# Tab 1');
    writeFileSync(testFile2, '# Tab 2');

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      // Open two files
      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile1);
      await expect(page.locator('.tab-item')).toHaveCount(1, { timeout: 5000 });

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile2);
      await expect(page.locator('.tab-item')).toHaveCount(2, { timeout: 5000 });

      // Tab 2 should be active (last opened)
      await expect(page.locator('.markdown-content h1')).toHaveText('Tab 2');

      // Navigate to previous tab via menu event
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('menu:prev-tab');
      });

      await expect(page.locator('.markdown-content h1')).toHaveText('Tab 1', { timeout: 3000 });

      // Navigate to next tab via menu event
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('menu:next-tab');
      });

      await expect(page.locator('.markdown-content h1')).toHaveText('Tab 2', { timeout: 3000 });

      await app.close();
    } finally {
      try {
        unlinkSync(testFile1);
      } catch {
        /* file may not exist */
      }
      try {
        unlinkSync(testFile2);
      } catch {
        /* file may not exist */
      }
    }
  });
});
