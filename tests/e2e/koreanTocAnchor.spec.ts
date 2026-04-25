import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'path';

const appPath = resolve(__dirname, '../../out/main/main.js');
const fixture = resolve(__dirname, 'fixtures/nav-korean-toc.md');

let app: ElectronApplication;
let page: Page;

test.describe('Korean TOC anchor navigation', () => {
  test.beforeEach(async () => {
    app = await electron.launch({ args: [appPath, fixture] });
    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.markdown-content');
    await page.waitForFunction(
      () => (document.querySelector('.markdown-content')?.textContent ?? '').includes('운영 매뉴얼'),
    );
  });

  test.afterEach(async () => {
    await app.close();
  });

  const headingVisibilityProbe = async (id: string) =>
    await page.evaluate((targetId) => {
      const el = document.getElementById(targetId);
      const view = document.querySelector('.markdown-view');
      if (!(el instanceof HTMLElement) || !(view instanceof HTMLElement)) {
        return { exists: false, topRelView: Number.NaN, viewportVisible: false };
      }
      const elRect = el.getBoundingClientRect();
      const viewRect = view.getBoundingClientRect();
      return {
        exists: true,
        topRelView: elRect.top - viewRect.top,
        viewportVisible: elRect.bottom > viewRect.top && elRect.top < viewRect.bottom,
      };
    }, id);

  // User-facing assertion: clicking a TOC anchor link should
  //   1) actually move the scroll position closer to the heading
  //   2) leave the heading visible in the markdown-view viewport
  const verifyClickScrollsToHeading = async (linkText: string, headingId: string): Promise<void> => {
    const initial = await headingVisibilityProbe(headingId);
    expect(initial.exists).toBe(true);
    await page.locator('.markdown-content a.link', { hasText: linkText }).first().click();
    await page.waitForTimeout(150);
    const final = await headingVisibilityProbe(headingId);
    expect(final.viewportVisible).toBe(true);
    // The heading should have moved noticeably closer to the top, OR was already
    // very near top (e.g. last heading in a short doc that can't scroll further).
    const moved = Math.abs(initial.topRelView - final.topRelView) > 20;
    const nearTop = Math.abs(final.topRelView) < 100;
    expect(moved || nearTop).toBe(true);
  };

  test('clicking 1. 문서 개요 TOC link scrolls heading into view near top', async () => {
    await verifyClickScrollsToHeading('문서 개요', '1-문서-개요');
  });

  test('clicking 2. 대시보드 사용법 TOC link scrolls heading into view near top', async () => {
    await verifyClickScrollsToHeading('대시보드 사용법', '2-대시보드-사용법');
  });

  test('clicking 3. Baseline TOC link scrolls heading into view near top', async () => {
    await verifyClickScrollsToHeading('Baseline', '3-정상-상태-기준-baseline');
  });
});
