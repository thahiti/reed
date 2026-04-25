# Mermaid Rendering — 설계 문서

- 작성일: 2026-04-25
- 상태: 승인됨 (구현 계획 작성 전 단계)
- 스코프: 코드 블록 ` ```mermaid `이 실제로 다이어그램으로 렌더되도록 만들고, 다크/라이트 테마 연동과 에러 fallback을 갖춘다.

## 배경

`mermaid` 패키지(`^11.14.0`), `MermaidDiagram` 컴포넌트, `createProcessor`의 mermaid 분기, 단위 테스트(`MermaidDiagram.test.tsx`)까지 인프라가 이미 존재한다. 그러나 `processMarkdown('```mermaid\n...```')`을 실제로 실행한 결과 mermaid 다이어그램이 렌더되지 않고 일반 코드 블록으로 출력된다.

### 근본 원인

`src/renderer/pipeline/createProcessor.ts:64`의 판별 로직은 strict equality다.

```ts
return childEl.props?.className === 'language-mermaid';
```

`rehype-highlight`가 `detect: true`로 동작하면서 모든 `<code class="language-*">`에 `hljs` 클래스를 추가한다. 따라서 실제 className은 `"hljs language-mermaid"`가 되어 위 비교는 항상 `false`다. `MermaidDiagram` 분기로 들어가지 못하고 일반 `CodeBlock`이 렌더된다.

기존 `MermaidDiagram.test.tsx`는 컴포넌트를 단독으로 mock과 함께 테스트해 이 회귀를 잡지 못했다.

### 부가 이슈 (이번 작업에서 함께 해결)

1. `MermaidDiagram`이 항상 `theme: 'default'`로 초기화되어 다크 모드와 시각적으로 충돌한다.
2. mermaid parse 오류 시 `mermaid.render()`가 reject되지만 UI에 아무것도 표시되지 않는다 (silent failure).

### 비목표

- mermaid 동적 import (lazy chunk 분리)
- chart prop 변경 시 promise cancel
- mermaid `themeVariables`로 앱 팔레트와 정확히 일치시키기
- 다른 다이어그램 엔진(plantuml 등) 추상화

## 아키텍처

### 변경되는 모듈

| 파일 | 변경 |
|---|---|
| `src/renderer/pipeline/createProcessor.ts` | `isMermaidPre`를 `className.split(' ').includes('language-mermaid')`로 수정 |
| `src/renderer/components/markdown/MermaidDiagram.tsx` | 테마 모드 구독, 에러 fallback, mermaid.initialize 정리 |
| `src/renderer/contexts/ThemeModeContext.tsx` (신규) | `'light' \| 'dark'` 모드를 노출하는 가벼운 컨텍스트 |
| `src/renderer/App.tsx` | `ThemeModeProvider`로 children 감싸기 |
| `src/renderer/hooks/useTheme.ts` | 반환값에 `mode` 추가 |
| `src/renderer/styles/markdown.css` | `.mermaid-error*` 스타일 추가 |

### 데이터 흐름

```
OS theme change (IPC)
  → useTheme(applyMode)
    → setMode('light' | 'dark')
      → ThemeModeContext value 갱신
        → MermaidDiagram useContext 재실행
          → mermaid.initialize({ theme: 'default' | 'dark' })
            → mermaid.render() 재호출
              → SVG 교체
```

### 의존성/번들

- `mermaid`는 정적 import 유지. 동적 import는 비목표.
- `createProcessor`는 mermaid를 직접 import하지 않으므로 영향 없음.

## 컴포넌트 인터페이스

### `ThemeModeContext`

```ts
// src/renderer/contexts/ThemeModeContext.tsx
type ThemeMode = 'light' | 'dark';
const ThemeModeContext = createContext<ThemeMode>('light');
export const useThemeMode = (): ThemeMode => useContext(ThemeModeContext);
export const ThemeModeProvider: FC<{ mode: ThemeMode; children: ReactNode }>;
```

- 단일 값(string)만 노출. settings/fonts/colors는 기존 `useTheme`이 CSS 변수로 처리하므로 컨텍스트가 떠안지 않는다.
- 기본값 `'light'` — provider 없이 렌더해도 안전 (테스트 단순화).

### `useTheme` 변경

- 반환 형태: `{ theme, mode, updateSettings }`
- 내부에서 이미 `applyMode(mode)`를 호출하므로 `mode`를 `useState`로 보관해 함께 노출만 하면 된다.

### `App.tsx`

```tsx
const { theme, mode, updateSettings } = useTheme();
return (
  <ThemeModeProvider mode={mode}>
    {/* 기존 children */}
  </ThemeModeProvider>
);
```

### `MermaidDiagram`

```ts
type Props = { readonly chart: string };

// 내부 상태: 'pending' | { svg: string } | { error: string }
// useThemeMode() 구독 → mode 변경 시 useEffect 재실행
// useEffect deps: [chart, mode]
```

규칙:

- `mermaid.initialize({ startOnLoad: false, theme: mode === 'dark' ? 'dark' : 'default', securityLevel: 'strict' })` — `theme`은 mermaid 전역 설정이므로 mode가 바뀌면 반드시 재호출한다.
- `mermaid.render(id, chart)`을 try/catch로 감싸 reject 시 `{ error: e.message }` 상태로 전이한다.
- 렌더 결과:
  - `pending` → `<div data-testid="mermaid-diagram" data-state="pending" />`
  - 성공 → 기존대로 `dangerouslySetInnerHTML`로 SVG 삽입, `data-state="ready"`
  - 실패 → 에러 박스 (아래)

### 에러 fallback (인라인 JSX)

```tsx
<div className="mermaid-error" data-testid="mermaid-error" data-state="error">
  <div className="mermaid-error__title">Mermaid 다이어그램을 그릴 수 없습니다</div>
  <pre className="mermaid-error__message">{error}</pre>
  <pre className="mermaid-error__source"><code>{chart}</code></pre>
</div>
```

별도 컴포넌트로 분리하지 않는다 (Rule of Three 미충족). CSS는 `markdown.css`에 `.mermaid-error*` 셀렉터로 추가한다 (빨간 테두리, 어두운 배경의 에러 텍스트).

### `createProcessor` 변경 핵심

```ts
const isMermaidPre = (props: AnyProps): boolean => {
  const child = getFirstChild(props);
  if (!child || typeof child !== 'object') return false;
  const className = (child as ChildElement).props?.className ?? '';
  return className.split(' ').includes('language-mermaid');
};
```

`getMermaidChart`는 변경하지 않는다 — `<code>`의 children이 여전히 string임을 probe로 확인했다.

## 테스트 전략

### 단위 테스트

1. **`createProcessor.test.ts`** — 통합 회귀 테스트 1개 추가.
   - 입력: ` ```mermaid\ngraph TD;\nA-->B;\n``` `
   - 검증: 결과 트리에 `data-testid="mermaid-diagram"`이 포함되고 `language-mermaid` 코드 블록으로 떨어지지 않는지.
   - **이 테스트가 RED → GREEN으로 전환되는 것이 1번 단위 기능의 신호.**

2. **`MermaidDiagram.test.tsx`** — 기존 1개에 3개 추가, mermaid 모듈은 계속 mock.
   - 다크 모드 provider 하에서 `mermaid.initialize`가 `theme: 'dark'` 인자로 호출되는지.
   - `mermaid.render`가 reject할 때 `data-testid="mermaid-error"`가 보이고 원본 차트 텍스트가 포함되는지.
   - 모드가 light → dark로 바뀌면 `mermaid.initialize`/`render`가 재호출되어 SVG가 갱신되는지.

3. **`ThemeModeContext.test.tsx`** (신규) — provider 없이 `useThemeMode()`가 `'light'` 기본값을 반환하는지 1건.

4. **`useTheme.test.ts`** — `mode` 노출 검증 1건 추가. light/dark IPC 이벤트 후 반환된 `mode`가 일치하는지.

### E2E 테스트

- **`tests/e2e/mermaid.spec.ts`** (신규) — 픽스처 markdown 파일에 mermaid 블록을 포함시켜 열고:
  - `.mermaid-diagram svg` 셀렉터가 DOM에 존재하고 visible한지.
  - 잘못된 mermaid 문법이 든 두 번째 픽스처에서 `.mermaid-error`가 보이는지.
- 다크 테마 토글 e2e는 비용 대비 효용이 낮아 단위 테스트(2번 케이스)로만 커버.

### Lint/Build 게이트

- ESLint, `pnpm build`, `pnpm build:app`은 매 단위 기능 커밋 직전에 통과해야 한다.

## 단위 기능 분해 (TDD 루프 단위)

이 작업은 6개의 atomic commit으로 쪼갠다. 각 단위 기능은 RED → GREEN → REFACTOR → LINT → (필요 시) E2E → COMMIT → BUILD 루프를 1바퀴 돈 뒤 다음으로 진행한다.

1. `fix(mermaid): match language-mermaid class with hljs prefix`
   `createProcessor` 한 줄 수정 + 통합 회귀 테스트. 가장 효과 크고 단독 가치 있음.
2. `feat(theme): expose mode from useTheme hook`
   반환값 추가 + 테스트.
3. `feat(theme): add ThemeModeContext provider`
   컨텍스트 생성, `App.tsx` 연결, 테스트.
4. `feat(mermaid): switch theme on mode change`
   `MermaidDiagram`이 `useThemeMode` 구독 + 단위 테스트.
5. `feat(mermaid): show error box on invalid syntax`
   try/catch + 에러 UI + CSS + 단위 테스트.
6. `test(mermaid): add e2e diagram render and error fallback`
   Playwright 픽스처 + 스펙.

## 위험 요소와 엣지 케이스

### 위험

1. **mermaid 전역 설정의 단일성** — `mermaid.initialize`는 모듈 전역에 적용된다. 한 페이지의 다이어그램 N개에 대해 모드 토글 시 N번 재실행된다. 본 스코프에서는 단순 재렌더로 두고, e2e에서 깜빡임이 보이면 후속 atomic commit으로 분리한다. 미리 과방어하지 않는다.

2. **`mermaid.render` 부수효과** — mermaid는 렌더 중 `<body>`에 임시 DOM을 만든다. id 충돌은 모듈 카운터(`mermaidId++`)로 회피한다. 빠른 재호출 시 임시 노드가 잠시 누적될 수 있으나 mermaid 11이 자체 cleanup한다.

3. **CSP / 보안** — mermaid 11은 외부 리소스를 fetch하지 않고 SVG만 반환한다. `securityLevel: 'strict'`(기본) 유지로 사용자 텍스트가 escape된다. 추가 sanitize 불필요.

4. **`hljs` 클래스 트리 변형 가능성** — 현재 probe에서 `<code>`의 children이 string으로 보존됨을 확인했다. 향후 `rehype-highlight` 옵션이 바뀌어 자식이 element 트리로 변하면 `getMermaidChart`가 깨질 수 있다. 통합 테스트가 회귀 방어선이다. 더 견고히 하려면 mermaid 블록을 `rehype-highlight` 이전에 가로채는 것이 정석이지만 YAGNI에 따라 보류.

5. **테마 모드 prop drilling 부재** — 컨텍스트 default 값이 `'light'`이므로 provider 누락 시에도 컴파일은 된다. 테스트(통합 + e2e)가 다크 토글 회귀를 잡는다.

### 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 빈 mermaid 블록 (` ```mermaid\n``` `) | mermaid reject → 에러 박스 (원본은 빈 문자열) |
| 매우 큰 다이어그램 | 동기적 SVG 렌더 → 일시적 메인 스레드 블로킹. 본 스코프 외, 측정 후 결정 |
| 동일 마크다운 내 mermaid 다수 | id 카운터로 분리 렌더. 모드 토글 시 모두 재렌더 |
| chart/mode 미변경 시 재렌더 | `useEffect` deps `[chart, mode]` → 같으면 재실행 안 함 |
| ` ```mermaid `이지만 실제로는 mermaid 아닌 텍스트 | parse error → 에러 박스 (원본 코드 노출) |
