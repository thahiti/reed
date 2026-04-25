import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'path';

const appPath = resolve(__dirname, '../../out/main/main.js');
const fixtureA = resolve(__dirname, 'fixtures/nav-a.md');

let app: ElectronApplication;
let page: Page;

test.describe('Link navigation', () => {
  test.beforeEach(async () => {
    app = await electron.launch({ args: [appPath, fixtureA] });
    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.markdown-content');
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Nav A') ?? false,
    );
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('clicking a relative .md link navigates within the same tab', async () => {
    const tabsBefore = await page.locator('.tab').count();
    await page.locator('.markdown-content a.link', { hasText: /^B$/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    const tabsAfter = await page.locator('.tab').count();
    expect(tabsAfter).toBe(tabsBefore);
    await expect(page.locator('.markdown-content')).toContainText('Target for anchor navigation');
  });

  test('anchor link scrolls to the target heading', async () => {
    await page.locator('.markdown-content a.link', { hasText: 'B intro' }).click();
    await page.waitForSelector('#intro-heading');
    const inView = await page.locator('#intro-heading').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    });
    expect(inView).toBe(true);
  });

  test('Ctrl+[ goes back and Ctrl+] goes forward', async () => {
    await page.locator('.markdown-content a.link', { hasText: /^B$/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    await page.keyboard.press('Control+BracketLeft');
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Some content for scroll testing') ?? false,
    );
    await expect(page.locator('.markdown-content')).toContainText('Nav A');
    await page.keyboard.press('Control+BracketRight');
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    await expect(page.locator('.markdown-content')).toContainText('Nav B');
  });

  test('navigating after a back truncates forward history', async () => {
    await page.locator('.markdown-content a.link', { hasText: /^B$/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    await page.keyboard.press('Control+BracketLeft');
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Some content for scroll testing') ?? false,
    );
    await page.locator('.markdown-content a.link', { hasText: 'B intro' }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    await page.keyboard.press('Control+BracketRight');
    // Forward should be NOOP — still on Nav B
    await expect(page.locator('.markdown-content')).toContainText('Nav B');
  });

  test('broken link flashes red and does not navigate', async () => {
    const linkLocator = page.locator('.markdown-content a.link', { hasText: 'missing' });
    await linkLocator.click();
    await expect(linkLocator).toHaveClass(/link-flash/);
    await expect(page.locator('.markdown-content')).toContainText('Nav A');
  });

  test('modified tab blocks link navigation with flash', async () => {
    // Navigate A -> B so we have history depth
    await page.locator('.markdown-content a.link', { hasText: /^B$/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    // Enter edit mode and dirty the tab
    await page.keyboard.press('KeyT');
    await page.waitForSelector('.cm-content');
    await page.locator('.cm-content').click();
    await page.keyboard.type('x');
    // Exit edit mode
    await page.keyboard.press('Escape');
    await page.waitForSelector('.markdown-content');
    // Click a relative link — must flash and not navigate
    const aLink = page.locator('.markdown-content a.link', { hasText: 'A' }).first();
    await aLink.click();
    await expect(aLink).toHaveClass(/link-flash/);
    await expect(page.locator('.markdown-content')).toContainText('Nav B');
  });

  test('modified tab blocks Ctrl+[ back navigation', async () => {
    await page.locator('.markdown-content a.link', { hasText: /^B$/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.markdown-content')?.textContent?.includes('Intro Heading') ?? false,
    );
    await page.keyboard.press('KeyT');
    await page.waitForSelector('.cm-content');
    await page.locator('.cm-content').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.markdown-content');
    await page.keyboard.press('Control+BracketLeft');
    // Wait briefly to ensure no navigation occurs
    await page.waitForTimeout(300);
    await expect(page.locator('.markdown-content')).toContainText('Nav B');
  });
});
