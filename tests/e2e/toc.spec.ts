import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

const sample = [
  '# Top',
  '',
  '## Alpha',
  '',
  'Text about alpha.',
  '',
  '## Beta',
  '',
  'Text about beta.',
  '',
  '### Beta sub',
  '',
  'More text.',
  '',
  '## Gamma',
  '',
  'Final section.',
  '',
].join('\n');

test.describe('TOC overlay', () => {
  test('O key toggles the overlay and item click scrolls to heading', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-toc.md');
    writeFileSync(testFile, sample);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.markdown-content')).toBeVisible();

      expect(await page.locator('aside.toc-overlay').count()).toBe(0);

      await page.keyboard.press('KeyO');
      await expect(page.locator('aside.toc-overlay')).toBeVisible();

      const activeItem = page.locator('aside.toc-overlay button[aria-current="location"]');
      await expect(activeItem).toHaveCount(1);
      await expect(activeItem).toHaveText('Alpha');

      await page.locator('aside.toc-overlay button', { hasText: 'Beta' }).first().click();
      await expect(page.locator('h2#beta')).toBeInViewport();

      await page.keyboard.press('KeyO');
      await expect(page.locator('aside.toc-overlay')).toHaveCount(0);

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });

  test('gg returns TOC active state to the first heading', async () => {
    const longSample = [
      '# Top',
      '',
      ...Array.from({ length: 20 }, (_, i) => `Intro paragraph ${String(i + 1)}.`).flatMap((p) => [p, '']),
      '## Alpha',
      '',
      ...Array.from({ length: 30 }, (_, i) => `Alpha paragraph ${String(i + 1)}.`).flatMap((p) => [p, '']),
      '## Beta',
      '',
      ...Array.from({ length: 30 }, (_, i) => `Beta paragraph ${String(i + 1)}.`).flatMap((p) => [p, '']),
      '## Gamma',
      '',
      'Gamma content.',
      '',
    ].join('\n');
    const testFile = resolve(__dirname, '../../test-fixture-toc-gg.md');
    writeFileSync(testFile, longSample);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.markdown-content')).toBeVisible();

      await page.keyboard.press('KeyO');
      await expect(page.locator('aside.toc-overlay')).toBeVisible();

      // Jump to Beta via TOC click
      await page.locator('aside.toc-overlay button', { hasText: 'Beta' }).first().click();
      await expect(page.locator('h2#beta')).toBeInViewport();
      await expect(
        page.locator('aside.toc-overlay button[aria-current="location"]'),
      ).toHaveText('Beta');

      // gg — go to top
      await page.keyboard.press('KeyG');
      await page.keyboard.press('KeyG');

      await expect(
        page.locator('aside.toc-overlay button[aria-current="location"]'),
      ).toHaveText('Alpha');

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });

  test('O key does not toggle the overlay in edit mode', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-toc-edit.md');
    writeFileSync(testFile, sample);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('KeyT');
      await expect(page.locator('.cm-content')).toBeVisible();

      await page.keyboard.press('KeyO');
      expect(await page.locator('aside.toc-overlay').count()).toBe(0);

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });
});
