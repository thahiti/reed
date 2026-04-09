# Font Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본문/코드 폰트를 View 메뉴에서 선택할 수 있는 기능 추가. 기본 본문 폰트를 SUIT로 변경.

**Architecture:** `src/shared/fonts.ts`에 폰트 레지스트리를 정의하고, `AppSettings`에 `bodyFont`/`codeFont` 필드를 추가. `useTheme` 훅에서 설정된 폰트 ID를 family 문자열로 변환하여 테마에 주입. View 메뉴의 라디오 버튼 서브메뉴로 전환.

**Tech Stack:** Electron, TypeScript, React, Vitest, @fontsource packages, woff2 직접 번들

**Spec:** `docs/superpowers/specs/2026-04-09-font-selection-design.md`

---

### Task 1: 폰트 파일 번들 및 CSS 설정

**Files:**
- Create: `src/renderer/assets/fonts/SUIT-Variable.woff2`
- Create: `src/renderer/assets/fonts/D2Coding-Ver1.3.2-20180524-all.woff2`
- Create: `src/renderer/assets/fonts/KoPubBatangMedium.woff2`
- Modify: `src/renderer/styles/fonts.css`
- Modify: `package.json`

- [ ] **Step 1: npm 패키지 설치**

```bash
pnpm add @fontsource/noto-serif-kr @fontsource/nanum-gothic-coding
```

- [ ] **Step 2: SUIT 폰트 다운로드**

SUIT Variable woff2를 GitHub 릴리스에서 다운로드:

```bash
mkdir -p src/renderer/assets/fonts
curl -L -o src/renderer/assets/fonts/SUIT-Variable.woff2 \
  "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.woff2"
```

- [ ] **Step 3: D2Coding 폰트 다운로드**

```bash
curl -L -o /tmp/D2Coding-Ver1.3.2-20180524-all.zip \
  "https://github.com/naver/d2codingfont/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524-all.zip"
unzip -o /tmp/D2Coding-Ver1.3.2-20180524-all.zip -d /tmp/d2coding
find /tmp/d2coding -name "D2Coding-Ver1.3.2-20180524-all.ttc" -exec cp {} /tmp/d2coding-all.ttc \;
```

D2Coding은 TTC 형식으로 배포되므로, woff2로 변환이 필요하다. 만약 변환이 어려우면 다른 방법을 사용한다:

```bash
# D2Coding subset woff만 있는 경우 - 공식 배포에서 woff2가 있는지 확인
# 없으면 D2CodingAll 전체 ttf를 사용
find /tmp/d2coding -name "*.ttf" | head -5
```

대안: D2Coding ligature 버전의 woff2가 CDN에 있으면 사용:

```bash
curl -L -o src/renderer/assets/fonts/D2Coding.woff2 \
  "https://cdn.jsdelivr.net/gh/woowahan-agile/D2Coding-Ligature@master/D2CodingLigature-Ver1.0-Regular.woff2" 2>/dev/null || \
curl -L -o src/renderer/assets/fonts/D2Coding.ttf \
  "https://cdn.jsdelivr.net/gh/naver/d2codingfont@master/D2Coding/D2Coding-Ver1.3.2-20180524.ttf"
```

실제 다운로드 가능한 경로를 확인하여 woff2 또는 ttf를 번들한다.

- [ ] **Step 4: KoPub Batang 다운로드**

```bash
curl -L -o src/renderer/assets/fonts/KoPubBatangMedium.woff2 \
  "https://cdn.jsdelivr.net/gh/nicbarker/KoPubBatang@main/KoPubBatangMedium.woff2" 2>/dev/null
```

KoPub Batang은 공식 배포처가 제한적이다. 실제 다운로드 경로를 확인하여 woff2 또는 otf를 번들한다. 한국저작권위원회 사이트에서 직접 다운로드가 필요할 수 있다.

**참고**: 폰트 파일 다운로드 URL은 정확하지 않을 수 있다. 실제 구현 시 각 폰트의 공식 배포 경로를 확인해야 한다.

- [ ] **Step 5: fonts.css 업데이트**

`src/renderer/styles/fonts.css`를 다음으로 교체:

```css
/* npm packages */
@import '@fontsource/jetbrains-mono/latin-400.css';
@import '@fontsource/jetbrains-mono/latin-700.css';
@import '@fontsource/noto-serif-kr/korean-400.css';
@import '@fontsource/noto-serif-kr/korean-700.css';
@import '@fontsource/nanum-gothic-coding/korean-400.css';
@import '@fontsource/nanum-gothic-coding/korean-700.css';
@import 'pretendard/dist/web/variable/pretendardvariable.css';
@import 'katex/dist/katex.min.css';

/* Bundled fonts */
@font-face {
  font-family: 'SUIT Variable';
  src: url('../assets/fonts/SUIT-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'D2Coding';
  src: url('../assets/fonts/D2Coding.woff2') format('woff2');
  font-weight: normal;
  font-display: swap;
}

@font-face {
  font-family: 'KoPubBatang';
  src: url('../assets/fonts/KoPubBatangMedium.woff2') format('woff2');
  font-weight: normal;
  font-display: swap;
}
```

Inter @import 4줄 제거 (더 이상 사용하지 않음).

- [ ] **Step 6: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add src/renderer/assets/fonts/ src/renderer/styles/fonts.css package.json pnpm-lock.yaml
git commit -m "chore(fonts): add SUIT, D2Coding, KoPub Batang, Noto Serif KR, Nanum Gothic Coding"
```

---

### Task 2: 폰트 레지스트리 생성

**Files:**
- Create: `src/shared/fonts.ts`
- Create: `tests/shared/fonts.test.ts`

- [ ] **Step 1: 테스트 작성**

`tests/shared/fonts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  bodyFonts,
  codeFonts,
  defaultBodyFontId,
  defaultCodeFontId,
  getBodyFontFamily,
  getCodeFontFamily,
} from '../../src/shared/fonts';

describe('fonts', () => {
  it('should have SUIT as default body font', () => {
    expect(defaultBodyFontId).toBe('suit');
  });

  it('should have JetBrains Mono as default code font', () => {
    expect(defaultCodeFontId).toBe('jetbrains-mono');
  });

  it('should return font family for valid body font id', () => {
    const family = getBodyFontFamily('suit');
    expect(family).toBe("'SUIT Variable', sans-serif");
  });

  it('should return font family for valid code font id', () => {
    const family = getCodeFontFamily('jetbrains-mono');
    expect(family).toBe("'JetBrains Mono', monospace");
  });

  it('should return default body font family for unknown id', () => {
    const family = getBodyFontFamily('nonexistent');
    expect(family).toBe("'SUIT Variable', sans-serif");
  });

  it('should return default code font family for unknown id', () => {
    const family = getCodeFontFamily('nonexistent');
    expect(family).toBe("'JetBrains Mono', monospace");
  });

  it('should have 4 body fonts', () => {
    expect(bodyFonts).toHaveLength(4);
  });

  it('should have 3 code fonts', () => {
    expect(codeFonts).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/shared/fonts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 폰트 레지스트리 구현**

`src/shared/fonts.ts`:

```typescript
export type FontEntry = {
  readonly id: string;
  readonly name: string;
  readonly family: string;
};

export const bodyFonts: ReadonlyArray<FontEntry> = [
  { id: 'suit', name: 'SUIT', family: "'SUIT Variable', sans-serif" },
  { id: 'pretendard', name: 'Pretendard', family: "'Pretendard Variable', sans-serif" },
  { id: 'noto-serif-kr', name: 'Noto Serif KR', family: "'Noto Serif KR', serif" },
  { id: 'kopub-batang', name: 'KoPub Batang', family: "'KoPubBatang', serif" },
];

export const codeFonts: ReadonlyArray<FontEntry> = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { id: 'd2coding', name: 'D2Coding', family: "'D2Coding', monospace" },
  { id: 'nanumgothic-coding', name: 'Nanum Gothic Coding', family: "'Nanum Gothic Coding', monospace" },
];

export const defaultBodyFontId = 'suit';
export const defaultCodeFontId = 'jetbrains-mono';

const findFont = (fonts: ReadonlyArray<FontEntry>, id: string, defaultId: string): string => {
  const found = fonts.find((f) => f.id === id);
  if (found) return found.family;
  const fallback = fonts.find((f) => f.id === defaultId);
  return fallback?.family ?? fonts[0]?.family ?? 'sans-serif';
};

export const getBodyFontFamily = (id: string): string =>
  findFont(bodyFonts, id, defaultBodyFontId);

export const getCodeFontFamily = (id: string): string =>
  findFont(codeFonts, id, defaultCodeFontId);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/shared/fonts.test.ts`
Expected: PASS

- [ ] **Step 5: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/shared/fonts.ts tests/shared/fonts.test.ts
git commit -m "feat(fonts): add font registry with body and code font definitions"
```

---

### Task 3: AppSettings에 bodyFont/codeFont 추가

**Files:**
- Modify: `src/shared/types.ts:64-69`
- Modify: `tests/shared/types.test.ts`

- [ ] **Step 1: 타입 테스트 작성**

`tests/shared/types.test.ts`에 추가:

```typescript
it('should allow AppSettings with bodyFont and codeFont', () => {
  const settings: AppSettings = {
    scroll: { stepLines: 8, pageLines: 30 },
    bodyFont: 'suit',
    codeFont: 'jetbrains-mono',
  };
  expect(settings.bodyFont).toBe('suit');
  expect(settings.codeFont).toBe('jetbrains-mono');
});

it('should allow AppSettings without bodyFont and codeFont', () => {
  const settings: AppSettings = {
    scroll: { stepLines: 8, pageLines: 30 },
  };
  expect(settings.bodyFont).toBeUndefined();
  expect(settings.codeFont).toBeUndefined();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/shared/types.test.ts`
Expected: FAIL — `bodyFont` does not exist on type `AppSettings`

- [ ] **Step 3: AppSettings 타입 수정**

`src/shared/types.ts`의 AppSettings에 추가:

```typescript
export type AppSettings = {
  readonly scroll: ScrollSettings;
  readonly bodyFont?: string;
  readonly codeFont?: string;
  readonly lightTheme?: ThemeOverrides;
  readonly darkTheme?: ThemeOverrides;
  readonly keybindings?: Partial<Record<string, string>>;
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/shared/types.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git commit -m "feat(types): add bodyFont and codeFont to AppSettings"
```

---

### Task 4: 테마에 폰트 설정 주입

**Files:**
- Modify: `src/renderer/themes/light.ts`
- Modify: `src/renderer/themes/dark.ts`
- Modify: `src/renderer/hooks/useTheme.ts`

- [ ] **Step 1: light.ts / dark.ts 기본 폰트 변경**

`src/renderer/themes/light.ts`의 fonts.body를 변경:

```typescript
fonts: {
  body: "'SUIT Variable', sans-serif",
  code: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  bodySize: '16px',
  codeSize: '14px',
  lineHeight: '1.7',
  codeLineHeight: '1.5',
},
```

`src/renderer/themes/dark.ts`도 동일하게 변경.

- [ ] **Step 2: useTheme.ts에 폰트 설정 주입**

`src/renderer/hooks/useTheme.ts`에 import 추가:

```typescript
import { getBodyFontFamily, getCodeFontFamily, defaultBodyFontId, defaultCodeFontId } from '../../shared/fonts';
```

`mergeTheme` 함수 아래에 폰트 주입 함수 추가:

```typescript
const applyFontSettings = (theme: Theme, settings: AppSettings | null): Theme => {
  const bodyFamily = getBodyFontFamily(settings?.bodyFont ?? defaultBodyFontId);
  const codeFamily = getCodeFontFamily(settings?.codeFont ?? defaultCodeFontId);
  return {
    ...theme,
    fonts: { ...theme.fonts, body: bodyFamily, code: codeFamily },
  };
};
```

`applyMode` 함수 내에서 `mergeTheme` 후 `applyFontSettings`를 적용:

```typescript
const applyMode = (mode: 'light' | 'dark') => {
  const base = themeMap[mode];
  const overrides = mode === 'light' ? settings?.lightTheme : settings?.darkTheme;
  const merged = mergeTheme(base, overrides);
  const withFonts = applyFontSettings(merged, settings);
  setTheme(withFonts);
  applyTheme(withFonts);
};
```

**주의**: ThemeOverrides.fonts.body가 설정되어 있으면 `mergeTheme`에서 이미 덮어씌워진다. `applyFontSettings`는 그 뒤에 적용되므로, ThemeOverrides가 우선하려면 순서를 반대로 해야 한다.

스펙에서 "ThemeOverrides가 우선"이라고 했으므로, 순서를 조정:

```typescript
const applyMode = (mode: 'light' | 'dark') => {
  const base = themeMap[mode];
  const withFonts = applyFontSettings(base, settings);
  const overrides = mode === 'light' ? settings?.lightTheme : settings?.darkTheme;
  const merged = mergeTheme(withFonts, overrides);
  setTheme(merged);
  applyTheme(merged);
};
```

이렇게 하면: 기본 테마 → 폰트 설정 적용 → ThemeOverrides 적용 (ThemeOverrides가 최종 우선).

- [ ] **Step 3: 전체 테스트**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/themes/light.ts src/renderer/themes/dark.ts src/renderer/hooks/useTheme.ts
git commit -m "feat(theme): inject font settings into theme with SUIT as default"
```

---

### Task 5: useTheme에 설정 업데이트 지원 추가

**Files:**
- Modify: `src/renderer/hooks/useTheme.ts`

현재 `useTheme`는 설정을 한 번만 로드한다. 폰트 메뉴에서 변경 시 설정이 업데이트되면 테마를 재적용해야 한다. `updateSettings` 함수를 반환하여 외부에서 설정 변경을 트리거할 수 있게 한다.

- [ ] **Step 1: useTheme 반환값에 updateSettings 추가**

```typescript
export const useTheme = () => {
  const [theme, setTheme] = useState(lightTheme);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void window.api.invoke('settings:get').then(setSettings);
  }, []);

  useEffect(() => {
    const applyMode = (mode: 'light' | 'dark') => {
      const base = themeMap[mode];
      const withFonts = applyFontSettings(base, settings);
      const overrides = mode === 'light' ? settings?.lightTheme : settings?.darkTheme;
      const merged = mergeTheme(withFonts, overrides);
      setTheme(merged);
      applyTheme(merged);
    };

    void window.api.invoke('theme:get-system').then(applyMode);

    const unsubscribe = window.api.on('theme:on-change', (mode: unknown) => {
      if (mode === 'light' || mode === 'dark') {
        applyMode(mode);
      }
    });

    return unsubscribe;
  }, [settings]);

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, []);

  return { theme, updateSettings };
};
```

import에 `useCallback` 추가.

- [ ] **Step 2: App.tsx에서 updateSettings 구조분해**

`src/renderer/App.tsx`에서:

```typescript
const { theme, updateSettings } = useTheme();
```

기존: `const { theme } = useTheme();`

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add src/renderer/hooks/useTheme.ts src/renderer/App.tsx
git commit -m "feat(theme): add updateSettings to useTheme for live font switching"
```

---

### Task 6: App.tsx — 폰트 메뉴 이벤트 핸들러

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 폰트 변경 핸들러 추가**

메뉴 이벤트 리스너 영역에 추가:

```typescript
// Menu — set body font
useEffect(() => {
  const unsub = window.api.on('menu:set-body-font', (fontId: unknown) => {
    if (typeof fontId !== 'string') return;
    void window.api.invoke('settings:get').then((current) => {
      const updated = { ...current, bodyFont: fontId };
      void window.api.invoke('settings:set', updated).then(() => {
        updateSettings(updated);
      });
    });
  });
  return unsub;
}, [updateSettings]);

// Menu — set code font
useEffect(() => {
  const unsub = window.api.on('menu:set-code-font', (fontId: unknown) => {
    if (typeof fontId !== 'string') return;
    void window.api.invoke('settings:get').then((current) => {
      const updated = { ...current, codeFont: fontId };
      void window.api.invoke('settings:set', updated).then(() => {
        updateSettings(updated);
      });
    });
  });
  return unsub;
}, [updateSettings]);
```

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/renderer/App.tsx
git commit -m "feat(app): handle font selection menu events"
```

---

### Task 7: 메뉴에 Body Font / Code Font 서브메뉴 추가

**Files:**
- Modify: `src/main/menu.ts`

- [ ] **Step 1: fonts import 추가**

`src/main/menu.ts` 상단에:

```typescript
import { bodyFonts, codeFonts, defaultBodyFontId, defaultCodeFontId } from '../shared/fonts';
```

- [ ] **Step 2: View 서브메뉴에 폰트 메뉴 추가**

View submenu에서 Toggle Edit Mode 뒤, Previous Tab 앞에 추가:

```typescript
{ type: 'separator' },
{
  label: 'Body Font',
  submenu: bodyFonts.map((font) => ({
    label: font.name,
    type: 'radio' as const,
    checked: (settings.bodyFont ?? defaultBodyFontId) === font.id,
    click: () => { mainWindow.webContents.send('menu:set-body-font', font.id); },
  })),
},
{
  label: 'Code Font',
  submenu: codeFonts.map((font) => ({
    label: font.name,
    type: 'radio' as const,
    checked: (settings.codeFont ?? defaultCodeFontId) === font.id,
    click: () => { mainWindow.webContents.send('menu:set-code-font', font.id); },
  })),
},
{ type: 'separator' },
```

기존 Toggle Edit Mode 뒤의 `{ type: 'separator' }`를 제거하고, 위 코드로 대체. Previous Tab 앞의 separator도 위 코드에 포함되어 있으므로 기존 것을 제거.

- [ ] **Step 3: helpContent 업데이트**

helpContent의 Settings 섹션에 추가:

```
## Fonts
- **View > Body Font** — Choose body text font (SUIT, Pretendard, Noto Serif KR, KoPub Batang)
- **View > Code Font** — Choose code font (JetBrains Mono, D2Coding, Nanum Gothic Coding)
```

- [ ] **Step 4: 메뉴가 설정 변경 후 라디오 상태를 반영하도록 처리**

메뉴의 radio 체크 상태는 메뉴 생성 시점의 settings를 기반으로 한다. 폰트 변경 후 메뉴를 재생성해야 라디오 상태가 업데이트된다.

`src/main/main.ts`에서 renderer가 설정 변경 시 메뉴를 재빌드하도록 한다:

`src/main/ipc/settingsHandlers.ts`의 `settings:set` 핸들러에서 콜백을 호출할 수 있도록 수정하거나, main.ts에서 settings:set 후 메뉴를 재빌드한다.

가장 간단한 방법: `src/main/main.ts`에서 `ipcMain.on` 이벤트를 추가하여 renderer가 설정 저장 후 `menu:rebuild`을 보내면 메뉴를 재빌드.

대신, 더 간단한 접근: renderer에서 settings를 저장한 후 `menu:rebuild` 이벤트를 main으로 보내고, main에서 메뉴를 재생성.

`src/renderer/App.tsx`의 폰트 변경 핸들러에서, settings 저장 후:

```typescript
void window.api.invoke('settings:get').then((current) => {
  const updated = { ...current, bodyFont: fontId };
  void window.api.invoke('settings:set', updated).then(() => {
    updateSettings(updated);
  });
});
```

이 흐름은 renderer → main (settings:set) → main에서 메뉴 재빌드가 자연스럽다.

`src/main/ipc/settingsHandlers.ts`에 메뉴 재빌드 콜백을 받도록 수정:

```typescript
export const registerSettingsHandlers = (onSettingsChange?: () => void): void => {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_event, settings: AppSettings) => {
    store.set('settings', settings);
    onSettingsChange?.();
  });

  ipcMain.handle('settings:open-file', () => {
    void shell.openPath(store.path);
  });
};
```

`src/main/main.ts`에서:

```typescript
const rebuildMenu = () => {
  const updatedSettings = getSettings();
  const menu = createMenu(mainWindow, updatedSettings);
  Menu.setApplicationMenu(menu);
};

registerSettingsHandlers(rebuildMenu);
```

- [ ] **Step 5: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/main/menu.ts src/main/main.ts src/main/ipc/settingsHandlers.ts
git commit -m "feat(menu): add Body Font and Code Font submenus to View menu"
```

---

### Task 8: E2E 테스트

**Files:**
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: E2E 테스트 작성**

```typescript
test('should change body font via menu event', async () => {
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Create a new tab to have content visible
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('menu:new-file');
  });
  await expect(page.locator('.tab-item')).toHaveCount(1, { timeout: 5000 });

  // Change body font to Pretendard
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('menu:set-body-font', 'pretendard');
  });

  // Verify CSS variable changed
  const fontFamily = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim(),
  );
  expect(fontFamily).toContain('Pretendard');

  await app.close();
});

test('should change code font via menu event', async () => {
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Change code font to D2Coding
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('menu:set-code-font', 'd2coding');
  });

  // Verify CSS variable changed
  const fontFamily = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim(),
  );
  expect(fontFamily).toContain('D2Coding');

  await app.close();
});
```

- [ ] **Step 2: 빌드 후 E2E 실행**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add tests/e2e/app.spec.ts
git commit -m "test(e2e): add font selection via menu event tests"
```

---

### Task 9: 최종 빌드 검증

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 4: 앱 빌드**

Run: `pnpm run build:app`
Expected: 빌드 성공

- [ ] **Step 5: 앱 설치 및 수동 검증**

```bash
cp -R dist/mac-arm64/Reed.app /Applications/Reed.app
```

수동 검증:
- View > Body Font > 각 폰트 선택 시 본문 폰트 변경 확인
- View > Code Font > 각 폰트 선택 시 코드 블록 폰트 변경 확인
- 앱 재시작 후 폰트 선택이 유지되는지 확인
- 라디오 버튼 체크 상태가 현재 선택과 일치하는지 확인
