import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const appPath = resolve(__dirname, '../../out/main/main.js');

let app: ElectronApplication;
let page: Page;
let workDir: string;
let filePath: string;

const initialBody = '# Original\n\nFirst version content.\n';
const updatedBody = '# Updated\n\nNew version content.\n';

test.describe('External file modification auto-reload', () => {
  test.beforeEach(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'reed-watch-'));
    filePath = join(workDir, 'doc.md');
    writeFileSync(filePath, initialBody, 'utf-8');

    app = await electron.launch({ args: [appPath, filePath] });
    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.markdown-content');
    await page.waitForFunction(
      () => (document.querySelector('.markdown-content')?.textContent ?? '').includes('Original'),
    );
  });

  test.afterEach(async () => {
    await app.close();
    rmSync(workDir, { recursive: true, force: true });
  });

  test('in-place write triggers content reload', async () => {
    // Capture file:changed IPC events from renderer
    const events: string[] = [];
    await page.exposeFunction('__recordEvent', (msg: string) => { events.push(msg); });
    await page.evaluate(() => {
      const w = window as unknown as {
        api: { on: (ch: string, cb: (...args: unknown[]) => void) => () => void };
        __recordEvent: (msg: string) => void;
      };
      w.api.on('file:changed', (...args: unknown[]) => {
        w.__recordEvent(`file:changed ${String(args[0])}`);
      });
    });

    writeFileSync(filePath, updatedBody, 'utf-8');

    // Allow watch debounce (300ms) + IPC + reload
    await page.waitForTimeout(1500);

    const content = await page.locator('.markdown-content').textContent();
    console.log('==EVENTS==', JSON.stringify(events));
    console.log('==CONTENT==', JSON.stringify((content ?? '').slice(0, 80)));
    expect(events.length).toBeGreaterThan(0);
    expect(content).toContain('Updated');
  });

  test('atomic rename write triggers content reload (editor pattern)', async () => {
    const events: string[] = [];
    await page.exposeFunction('__recordEventA', (msg: string) => { events.push(msg); });
    await page.evaluate(() => {
      const w = window as unknown as {
        api: { on: (ch: string, cb: (...args: unknown[]) => void) => () => void };
        __recordEventA: (msg: string) => void;
      };
      w.api.on('file:changed', (...args: unknown[]) => {
        w.__recordEventA(`file:changed ${String(args[0])}`);
      });
    });

    // Simulate atomic-save: write to temp + rename onto target
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, updatedBody, 'utf-8');
    renameSync(tmp, filePath);

    await page.waitForTimeout(1500);

    const content = await page.locator('.markdown-content').textContent();
    console.log('==EVENTS_A==', JSON.stringify(events));
    console.log('==CONTENT_A==', JSON.stringify((content ?? '').slice(0, 80)));
    expect(events.length).toBeGreaterThan(0);
    expect(content).toContain('Updated');
  });

  test('two consecutive in-place writes both reflected', async () => {
    writeFileSync(filePath, '# V2\n\nSecond.\n', 'utf-8');
    await page.waitForTimeout(1000);
    const after1 = await page.locator('.markdown-content').textContent();

    writeFileSync(filePath, '# V3\n\nThird.\n', 'utf-8');
    await page.waitForTimeout(1000);
    const after2 = await page.locator('.markdown-content').textContent();

    console.log('==AFTER1==', JSON.stringify((after1 ?? '').slice(0, 60)));
    console.log('==AFTER2==', JSON.stringify((after2 ?? '').slice(0, 60)));

    expect(after1).toContain('V2');
    expect(after2).toContain('V3');
  });
});
