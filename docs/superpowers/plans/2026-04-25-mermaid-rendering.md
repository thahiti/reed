# Mermaid Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ` ```mermaid ` 코드 블록이 실제로 SVG 다이어그램으로 렌더되도록 만들고, 다크/라이트 테마 연동과 parse 오류 시 인라인 에러 fallback을 추가한다.

**Architecture:** `createProcessor`의 잘못된 className 매칭(strict equality)을 split-include 방식으로 고쳐 mermaid 분기를 활성화한다. 가벼운 `ThemeModeContext`로 현재 테마 모드(`'light' | 'dark'`)를 트리에 흘려보내고, `MermaidDiagram`이 이를 구독해 mermaid 전역 테마를 갱신한다. `mermaid.render` reject는 try/catch로 잡아 동일 컴포넌트 내에서 에러 박스를 렌더한다.

**Tech Stack:** React 19, Electron 33, unified/rehype-react, mermaid 11, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-25-mermaid-rendering-design.md`

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/renderer/pipeline/createProcessor.ts` | mermaid 코드 블록 감지 | 수정 (`isMermaidPre` 한 함수) |
| `src/renderer/hooks/useTheme.ts` | 테마/모드 상태 관리 | 수정 (반환값에 `mode` 추가) |
| `src/renderer/contexts/ThemeModeContext.tsx` | 모드만 노출하는 가벼운 컨텍스트 | 신규 |
| `src/renderer/App.tsx` | 트리 최상위 provider 부착 | 수정 (Provider 래핑) |
| `src/renderer/components/markdown/MermaidDiagram.tsx` | 차트 렌더 + 테마 반응 + 에러 fallback | 거의 재작성 |
| `src/renderer/styles/markdown.css` | 에러 박스 스타일 | 수정 (`.mermaid-error*` 추가) |
| `tests/renderer/pipeline/createProcessor.test.ts` | 통합 회귀 검증 | 케이스 1개 추가 |
| `tests/renderer/hooks/useTheme.test.ts` | mode 노출 검증 | 케이스 1개 추가 |
| `tests/renderer/contexts/ThemeModeContext.test.tsx` | 컨텍스트 기본값 | 신규 |
| `tests/renderer/components/markdown/MermaidDiagram.test.tsx` | 다크 테마 / 에러 / 모드 전환 | 케이스 3개 추가 |
| `tests/e2e/mermaid.spec.ts` | 정상/에러 e2e | 신규 |

---

## Task 1: Fix className matching in createProcessor

CLAUDE.md의 Development Loop 1번(PICK)으로 시작. 현재 ` ```mermaid `가 일반 CodeBlock으로 폴백되는 단일 버그를 잡는다. `getMermaidChart` 시그니처와 동작은 변경하지 않는다 — children이 string으로 보존됨이 검증되어 있다.

**Files:**
- Modify: `src/renderer/pipeline/createProcessor.ts:60-65` (`isMermaidPre`)
- Test: `tests/renderer/pipeline/createProcessor.test.ts`

- [ ] **Step 1: Write the failing integration test**

`tests/renderer/pipeline/createProcessor.test.ts`의 마지막 `it` 블록 다음(닫는 `});` 직전)에 추가:

```ts
  it('should render mermaid code block as MermaidDiagram component', () => {
    const md = '```mermaid\ngraph TD;\nA-->B;\n```';
    const { rendered } = processMarkdown(md);
    const json = JSON.stringify(rendered);
    expect(json).toContain('mermaid-diagram');
    expect(json).not.toMatch(/"className":"hljs language-mermaid"/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test --run tests/renderer/pipeline/createProcessor.test.ts
```

Expected: 새 케이스만 실패. 출력에 `Expected substring: "mermaid-diagram"`이 포함되고 다른 14개 케이스는 통과.

- [ ] **Step 3: Replace strict equality with class-list match**

`src/renderer/pipeline/createProcessor.ts:60-65`의 `isMermaidPre`를 다음으로 교체:

```ts
const isMermaidPre = (props: AnyProps): boolean => {
  const child = getFirstChild(props);
  if (!child || typeof child !== 'object') return false;
  const childEl = child as ChildElement;
  const className = childEl.props?.className ?? '';
  return className.split(' ').includes('language-mermaid');
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test --run tests/renderer/pipeline/createProcessor.test.ts
```

Expected: 모든 케이스 PASS (15개).

- [ ] **Step 5: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pipeline/createProcessor.ts tests/renderer/pipeline/createProcessor.test.ts
git commit -m "fix(mermaid): match language-mermaid class with hljs prefix"
```

- [ ] **Step 7: Build smoke**

Run:
```bash
pnpm run build:app
```

Expected: 성공 종료. 산출물 경고만 있고 에러 없음.

---

## Task 2: Expose `mode` from `useTheme` hook

테마 모드가 이미 내부 상태로 흐르지만 외부로는 `theme` 객체만 노출된다. mermaid를 위해 `'light' | 'dark'` 식별자를 명시적으로 반환한다.

**Files:**
- Modify: `src/renderer/hooks/useTheme.ts`
- Test: `tests/renderer/hooks/useTheme.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/renderer/hooks/useTheme.test.ts`의 마지막 `it` 다음에 추가:

```ts
  it('should expose mode "light" by default', async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.mode).toBe('light');
  });

  it('should expose mode "dark" when system is dark', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'settings:get') return Promise.resolve(null);
      return Promise.resolve('dark');
    });
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.mode).toBe('dark');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test --run tests/renderer/hooks/useTheme.test.ts
```

Expected: 두 새 케이스 모두 실패 (`Expected: "light", Received: undefined`).

- [ ] **Step 3: Add `mode` state and return it**

`src/renderer/hooks/useTheme.ts`를 다음으로 교체:

```ts
import { useState, useEffect, useCallback } from 'react';
import { lightTheme } from '../themes/light';
import { darkTheme } from '../themes/dark';
import { applyTheme } from '../themes/applyTheme';
import type { Theme } from '../themes/types';
import type { AppSettings, ThemeOverrides } from '../../shared/types';
import { getBodyFontFamily, getCodeFontFamily, defaultBodyFontId, defaultCodeFontId } from '../../shared/fonts';

type ThemeMode = 'light' | 'dark';

const themeMap = { light: lightTheme, dark: darkTheme } as const;

const mergeTheme = (base: Theme, overrides?: ThemeOverrides): Theme => {
  if (!overrides) return base;
  return {
    ...base,
    fonts: { ...base.fonts, ...overrides.fonts },
    colors: { ...base.colors, ...overrides.colors },
  };
};

const applyFontSettings = (theme: Theme, settings: AppSettings | null): Theme => {
  const bodyFamily = getBodyFontFamily(settings?.bodyFont ?? defaultBodyFontId);
  const codeFamily = getCodeFontFamily(settings?.codeFont ?? defaultCodeFontId);
  return {
    ...theme,
    fonts: { ...theme.fonts, body: bodyFamily, code: codeFamily },
  };
};

export const useTheme = () => {
  const [theme, setTheme] = useState(lightTheme);
  const [mode, setMode] = useState<ThemeMode>('light');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load settings once
  useEffect(() => {
    void window.api.invoke('settings:get').then(setSettings);
  }, []);

  useEffect(() => {
    const applyMode = (next: ThemeMode) => {
      const base = themeMap[next];
      const withFonts = applyFontSettings(base, settings);
      const overrides = next === 'light' ? settings?.lightTheme : settings?.darkTheme;
      const merged = mergeTheme(withFonts, overrides);
      setMode(next);
      setTheme(merged);
      applyTheme(merged);
    };

    void window.api.invoke('theme:get-system').then(applyMode);

    const unsubscribe = window.api.on('theme:on-change', (next: unknown) => {
      if (next === 'light' || next === 'dark') {
        applyMode(next);
      }
    });

    return unsubscribe;
  }, [settings]);

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, []);

  return { theme, mode, updateSettings };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test --run tests/renderer/hooks/useTheme.test.ts
```

Expected: 모든 케이스 PASS (5개).

- [ ] **Step 5: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useTheme.ts tests/renderer/hooks/useTheme.test.ts
git commit -m "feat(theme): expose mode from useTheme hook"
```

---

## Task 3: Add `ThemeModeContext` and wire it in App

App 트리 최상위에서 `mode`를 컨텍스트로 흘려, MermaidDiagram이 prop drilling 없이 구독할 수 있도록 한다.

**Files:**
- Create: `src/renderer/contexts/ThemeModeContext.tsx`
- Modify: `src/renderer/App.tsx:19, 491-548` (hook 반환 분해 + JSX 래핑)
- Test: `tests/renderer/contexts/ThemeModeContext.test.tsx` (신규)

- [ ] **Step 1: Write the failing context test**

새 파일 `tests/renderer/contexts/ThemeModeContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeProvider, useThemeMode } from '../../../src/renderer/contexts/ThemeModeContext';

const Probe = () => <span data-testid="mode">{useThemeMode()}</span>;

describe('ThemeModeContext', () => {
  it('should default to "light" without provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('should expose provider value', () => {
    render(
      <ThemeModeProvider mode="dark">
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test --run tests/renderer/contexts/ThemeModeContext.test.tsx
```

Expected: import 실패 — `Failed to resolve import "../../../src/renderer/contexts/ThemeModeContext"`.

- [ ] **Step 3: Create the context module**

새 파일 `src/renderer/contexts/ThemeModeContext.tsx`:

```tsx
import { createContext, useContext, type FC, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const ThemeModeContext = createContext<ThemeMode>('light');

export const useThemeMode = (): ThemeMode => useContext(ThemeModeContext);

type Props = {
  readonly mode: ThemeMode;
  readonly children: ReactNode;
};

export const ThemeModeProvider: FC<Props> = ({ mode, children }) => (
  <ThemeModeContext.Provider value={mode}>{children}</ThemeModeContext.Provider>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test --run tests/renderer/contexts/ThemeModeContext.test.tsx
```

Expected: 두 케이스 모두 PASS.

- [ ] **Step 5: Wire provider into `App.tsx`**

`src/renderer/App.tsx:16` 다음 줄에 import 추가:

```ts
import { ThemeModeProvider } from './contexts/ThemeModeContext';
```

`src/renderer/App.tsx:19`을 다음으로 교체:

```ts
  const { theme, mode, updateSettings } = useTheme();
```

`src/renderer/App.tsx:491-492`의 `return (` 와 `<div className="app">` 사이를 다음 구조로 변경 — 즉, 기존 최상위 `<div className="app">…</div>` 전체를 `<ThemeModeProvider mode={mode}>…</ThemeModeProvider>`로 감싼다:

```tsx
  return (
    <ThemeModeProvider mode={mode}>
      <div className="app">
        {/* 기존 children 그대로 */}
      </div>
    </ThemeModeProvider>
  );
```

(`</div>` 뒤에 닫는 `</ThemeModeProvider>`를 추가하는 것을 잊지 말 것.)

- [ ] **Step 6: Run all renderer tests to verify no regressions**

Run:
```bash
pnpm test
```

Expected: 모든 케이스 PASS.

- [ ] **Step 7: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/contexts/ThemeModeContext.tsx src/renderer/App.tsx tests/renderer/contexts/ThemeModeContext.test.tsx
git commit -m "feat(theme): add ThemeModeContext provider"
```

---

## Task 4: MermaidDiagram reacts to theme mode

`MermaidDiagram`이 `useThemeMode`를 구독하고, 모드가 바뀌면 `mermaid.initialize`를 다시 호출한 뒤 `mermaid.render`로 SVG를 갱신한다.

**Files:**
- Modify: `src/renderer/components/markdown/MermaidDiagram.tsx` (전체 재작성)
- Test: `tests/renderer/components/markdown/MermaidDiagram.test.tsx`

- [ ] **Step 1: Replace existing test with theme-aware suite**

`tests/renderer/components/markdown/MermaidDiagram.test.tsx`를 다음으로 교체 (기존 1 케이스 + 신규 2 케이스):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from '../../../../src/renderer/components/markdown/MermaidDiagram';
import { ThemeModeProvider } from '../../../../src/renderer/contexts/ThemeModeContext';

const initializeMock = vi.fn();
const renderMock = vi.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">ok</svg>' });

vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

describe('MermaidDiagram', () => {
  beforeEach(() => {
    initializeMock.mockClear();
    renderMock.mockClear();
    renderMock.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">ok</svg>' });
  });

  it('should render mermaid diagram as SVG with light theme by default', async () => {
    render(<MermaidDiagram chart="graph TD; A-->B;" />);
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    });
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'default', startOnLoad: false }),
    );
  });

  it('should initialize with theme "dark" inside dark provider', async () => {
    render(
      <ThemeModeProvider mode="dark">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
  });

  it('should re-render when mode changes from light to dark', async () => {
    const { rerender } = render(
      <ThemeModeProvider mode="light">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
    });
    initializeMock.mockClear();
    renderMock.mockClear();

    rerender(
      <ThemeModeProvider mode="dark">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
    expect(renderMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failures**

Run:
```bash
pnpm test --run tests/renderer/components/markdown/MermaidDiagram.test.tsx
```

Expected: 다크 테마 케이스와 모드 전환 케이스가 실패 (initialize는 항상 `theme: 'default'`로 호출됨).

- [ ] **Step 3: Rewrite `MermaidDiagram.tsx` to consume theme mode**

`src/renderer/components/markdown/MermaidDiagram.tsx` 전체를 다음으로 교체:

```tsx
import { type FC, useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useThemeMode } from '../../contexts/ThemeModeContext';

type MermaidDiagramProps = {
  readonly chart: string;
};

let mermaidId = 0;

export const MermaidDiagram: FC<MermaidDiagramProps> = ({ chart }) => {
  const mode = useThemeMode();
  const [svg, setSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    const id = `mermaid-${String(++mermaidId)}`;
    void mermaid.render(id, chart).then(({ svg: rendered }) => {
      setSvg(rendered);
    });
  }, [chart, mode]);

  return (
    <div
      className="mermaid-diagram"
      data-testid="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
```

(에러 처리는 Task 5에서 추가한다 — 이번 단계는 테마 반응성만.)

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test --run tests/renderer/components/markdown/MermaidDiagram.test.tsx
```

Expected: 세 케이스 모두 PASS.

- [ ] **Step 5: Run full test suite to confirm no regression**

Run:
```bash
pnpm test
```

Expected: 모두 PASS.

- [ ] **Step 6: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/markdown/MermaidDiagram.tsx tests/renderer/components/markdown/MermaidDiagram.test.tsx
git commit -m "feat(mermaid): switch theme on mode change"
```

---

## Task 5: Show error fallback on invalid mermaid syntax

`mermaid.render`가 reject할 때 빨간 테두리 박스에 에러 메시지와 원본 차트를 노출한다.

**Files:**
- Modify: `src/renderer/components/markdown/MermaidDiagram.tsx`
- Modify: `src/renderer/styles/markdown.css:99-100` 다음 줄에 에러 스타일 추가
- Test: `tests/renderer/components/markdown/MermaidDiagram.test.tsx`

- [ ] **Step 1: Add the failing error-path test**

`tests/renderer/components/markdown/MermaidDiagram.test.tsx`의 마지막 `it` 다음(닫는 `});` 직전)에 추가:

```tsx
  it('should render error box with source when mermaid.render rejects', async () => {
    renderMock.mockRejectedValueOnce(new Error('Parse error: bad syntax'));
    render(<MermaidDiagram chart="graph !!!" />);
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mermaid-error').textContent).toContain('Parse error: bad syntax');
    expect(screen.getByTestId('mermaid-error').textContent).toContain('graph !!!');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test --run tests/renderer/components/markdown/MermaidDiagram.test.tsx
```

Expected: 새 케이스 실패 (`Unable to find an element by: [data-testid="mermaid-error"]`). 또한 unhandled promise rejection 경고가 stderr에 보일 수 있음.

- [ ] **Step 3: Add try/catch and error UI in the component**

`src/renderer/components/markdown/MermaidDiagram.tsx` 전체를 다음으로 교체:

```tsx
import { type FC, useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useThemeMode } from '../../contexts/ThemeModeContext';

type MermaidDiagramProps = {
  readonly chart: string;
};

type State =
  | { readonly status: 'pending' }
  | { readonly status: 'ready'; readonly svg: string }
  | { readonly status: 'error'; readonly message: string };

let mermaidId = 0;

export const MermaidDiagram: FC<MermaidDiagramProps> = ({ chart }) => {
  const mode = useThemeMode();
  const [state, setState] = useState<State>({ status: 'pending' });

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    const id = `mermaid-${String(++mermaidId)}`;
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        setState({ status: 'ready', svg });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      });
  }, [chart, mode]);

  if (state.status === 'error') {
    return (
      <div className="mermaid-error" data-testid="mermaid-error" data-state="error">
        <div className="mermaid-error__title">Mermaid 다이어그램을 그릴 수 없습니다</div>
        <pre className="mermaid-error__message">{state.message}</pre>
        <pre className="mermaid-error__source"><code>{chart}</code></pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram"
      data-testid="mermaid-diagram"
      data-state={state.status}
      dangerouslySetInnerHTML={{ __html: state.status === 'ready' ? state.svg : '' }}
    />
  );
};
```

- [ ] **Step 4: Add CSS for error box**

`src/renderer/styles/markdown.css:100` 다음 줄(즉 `.mermaid-diagram svg { … }` 바로 아래)에 추가:

```css
.mermaid-error {
  margin-bottom: var(--spacing-paragraph);
  padding: 12px 16px;
  border: 1px solid #d33;
  border-left-width: 4px;
  border-radius: 6px;
  background-color: var(--color-code-bg);
}
.mermaid-error__title {
  color: #d33;
  font-weight: 600;
  margin-bottom: 8px;
}
.mermaid-error__message {
  margin: 0 0 8px 0;
  font-family: var(--font-code);
  font-size: 13px;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}
.mermaid-error__source {
  margin: 0;
  padding: 8px;
  background-color: var(--color-bg);
  border-radius: 4px;
  font-family: var(--font-code);
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
pnpm test --run tests/renderer/components/markdown/MermaidDiagram.test.tsx
```

Expected: 네 케이스 모두 PASS.

- [ ] **Step 6: Run full suite**

Run:
```bash
pnpm test
```

Expected: 모두 PASS.

- [ ] **Step 7: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/markdown/MermaidDiagram.tsx src/renderer/styles/markdown.css tests/renderer/components/markdown/MermaidDiagram.test.tsx
git commit -m "feat(mermaid): show error box on invalid syntax"
```

---

## Task 6: E2E coverage for diagram render and error fallback

실제 Electron 환경에서 mermaid가 SVG로 그려지고 잘못된 문법 시 에러 박스가 보이는지 확인한다.

**Files:**
- Create: `tests/e2e/mermaid.spec.ts`

- [ ] **Step 1: Build the app first (e2e launches the built main bundle)**

Run:
```bash
pnpm build
```

Expected: 성공 종료. `out/main/main.js`가 갱신됨.

- [ ] **Step 2: Write the e2e test**

새 파일 `tests/e2e/mermaid.spec.ts`:

```ts
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
      '# Bad Diagram\n\n```mermaid\nthis is not mermaid syntax !!!\n```\n',
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
      await expect(errorBox).toContainText('this is not mermaid syntax');

      await app.close();
    } finally {
      try { unlinkSync(testFile); } catch { /* */ }
    }
  });
});
```

- [ ] **Step 3: Run the e2e test**

Run:
```bash
pnpm test:e2e tests/e2e/mermaid.spec.ts
```

Expected: 두 케이스 모두 PASS. 첫 실행이 느릴 수 있음 (Electron 부팅 × 2회).

> **트러블슈팅**: `mermaid-error`가 visible하지 않으면 `securityLevel: 'strict'`이 어떤 입력은 syntax error 대신 빈 SVG로 처리할 수 있음. 실패하면 픽스처를 더 명백히 잘못된 mermaid (`flowchart\n  A --bad-> B`)로 바꾼 뒤 재실행. 그래도 안 되면 fixture 변경을 동일 PR에 포함시켜 커밋.

- [ ] **Step 4: Run full unit suite (sanity)**

Run:
```bash
pnpm test
```

Expected: 모두 PASS.

- [ ] **Step 5: Lint**

Run:
```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/mermaid.spec.ts
git commit -m "test(mermaid): add e2e diagram render and error fallback"
```

- [ ] **Step 7: Final build smoke**

Run:
```bash
pnpm run build:app
```

Expected: 성공 종료. dmg 패키지는 만들지 않음(`--dir` 모드).

---

## Verification Checklist

전체 작업이 끝난 후 한 번에 실행해 회귀를 잡는다.

- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm test` — 모든 케이스 PASS
- [ ] `pnpm build` — 성공
- [ ] `pnpm test:e2e tests/e2e/mermaid.spec.ts` — 2 cases PASS
- [ ] `pnpm run build:app` — 성공
- [ ] 수동 확인: `pnpm dev`로 앱 띄우고 mermaid 블록이 든 마크다운을 열어 다이어그램이 그려지는지, 시스템 다크모드를 토글했을 때 다이어그램이 다크 톤으로 다시 그려지는지 확인.

## Out of Scope (이번 PR에서 하지 않음)

- mermaid 동적 import (lazy chunk 분리)
- chart prop 변경 시 promise cancellation
- `themeVariables`로 앱 팔레트와 정확히 일치시키는 커스텀 테마
- mermaid 외 다른 다이어그램 엔진 추상화
