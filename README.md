# MDViewer

마크다운 문서를 아름답게 렌더링하는 읽기 전용 데스크톱 뷰어.

편집 기능 없이 **렌더링 품질**에 집중합니다. 깔끔한 타이포그래피, 잘 정돈된 레이아웃, 세련된 색상으로 마크다운 문서를 읽는 것이 즐거운 경험이 되도록 설계했습니다.

## 주요 기능

- **아름다운 렌더링** — 제목, 테이블, 코드 블록, 인용문, 체크리스트 등 주요 마크다운 요소를 세련되게 표시
- **Syntax Highlighting** — GitHub 스타일 코드 하이라이팅
- **수식 렌더링** — KaTeX 기반 인라인/블록 수식 (`$...$`, `$$...$$`)
- **Mermaid 다이어그램** — flowchart, sequence diagram 등 SVG 렌더링
- **다크/라이트 모드** — macOS 시스템 설정 자동 연동
- **다중 탭** — 여러 문서를 탭으로 전환하며 열람
- **Quick Open (`Cmd+P`)** — 최근 열었던 파일 퍼지 검색
- **Drag & Drop** — 파일을 앱 윈도우에 드래그하여 열기
- **File Association** — `.md` 파일 더블클릭으로 바로 열기

## 스크린샷

> `pnpm dev`로 앱을 실행하여 직접 확인하세요.

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Electron 33+ |
| UI | React 19 |
| 언어 | TypeScript (strict mode) |
| 빌드 | electron-vite |
| 마크다운 | unified / remark / rehype 파이프라인 |
| 수식 | KaTeX |
| 다이어그램 | Mermaid |
| 코드 하이라이팅 | highlight.js (GitHub 테마) |
| 검색 | fuse.js (퍼지 매칭) |
| 저장 | electron-store (파일 이력) |
| 테스트 | Vitest (unit) + Playwright (e2e) |
| 린트 | ESLint + Prettier |
| 패키지 관리 | pnpm |

## 폰트

앱에 번들되어 오프라인에서도 동작합니다.

| 용도 | 폰트 |
|------|------|
| 영문 본문 | [Inter](https://rsms.me/inter/) |
| 한글 본문 | [Pretendard](https://cactus.tistory.com/306) |
| 코드 블록 | [JetBrains Mono](https://www.jetbrains.com/lp/mono/) |

## 시작하기

### 사전 요구사항

- Node.js 18+
- pnpm

### 설치

```bash
git clone <repository-url>
cd mdviewer
pnpm install
```

### 개발 서버 실행

```bash
pnpm dev
```

HMR이 적용되어 코드 변경 시 자동으로 반영됩니다.

### 빌드

```bash
pnpm build
```

빌드 결과물은 `out/` 디렉토리에 생성됩니다.

### 테스트

```bash
# 단위 테스트
pnpm test

# E2E 테스트 (빌드 필요)
pnpm build && pnpm test:e2e

# 린트
pnpm lint
```

## 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd+O` | 파일 열기 |
| `Cmd+P` | Quick Open (최근 파일 검색) |
| `Cmd+W` | 현재 탭 닫기 |
| `Cmd+1~9` | N번째 탭으로 전환 |
| `Cmd+Shift+[` | 이전 탭 |
| `Cmd+Shift+]` | 다음 탭 |

## 프로젝트 구조

```
src/
├── main/                  # Main process (Node.js)
│   ├── main.ts            # 앱 엔트리, BrowserWindow
│   ├── menu.ts            # 앱 메뉴 (File, View, Window)
│   └── ipc/
│       ├── fileHandlers.ts    # 파일 읽기, 경로 해석
│       ├── historyHandlers.ts # 최근 파일 이력 관리
│       └── themeHandlers.ts   # 시스템 테마 감지
├── preload/
│   └── preload.ts         # contextBridge API 노출
├── renderer/              # Renderer process (React)
│   ├── App.tsx            # 탭 + 테마 + 파일 열기 통합
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── MarkdownView.tsx
│   │   ├── QuickOpen.tsx
│   │   ├── Welcome.tsx
│   │   └── markdown/     # 마크다운 요소별 컴포넌트 (12종)
│   ├── hooks/
│   │   ├── useMarkdown.ts # 마크다운 → React 변환
│   │   ├── useTabs.ts     # 탭 상태 관리
│   │   ├── useTheme.ts    # 테마 + 시스템 연동
│   │   └── useQuickOpen.ts
│   ├── pipeline/
│   │   └── createProcessor.ts  # unified 렌더링 파이프라인
│   ├── themes/            # 테마 시스템 (분리 가능)
│   │   ├── types.ts
│   │   ├── light.ts
│   │   ├── dark.ts
│   │   └── applyTheme.ts
│   └── styles/            # CSS (CSS Variables 기반)
└── shared/
    └── types.ts           # IPC 채널 타입 정의
```

## 아키텍처

```
┌────────────────────────────────┐
│         Main Process           │
│  파일 I/O, 메뉴, 테마 감지      │
└──────────────┬─────────────────┘
               │ IPC (typed channels)
┌──────────────┴─────────────────┐
│       Preload Script           │
│  contextBridge 최소 API 노출    │
└──────────────┬─────────────────┘
               │ window.api
┌──────────────┴─────────────────┐
│      Renderer Process          │
│  React + unified 파이프라인      │
│  마크다운 → React 컴포넌트 트리   │
└────────────────────────────────┘
```

### 마크다운 렌더링 파이프라인

```
markdown string
  → remark-parse     (마크다운 → AST)
  → remark-gfm       (테이블, 체크리스트, 취소선)
  → remark-math       (수식 추출)
  → remark-rehype     (AST → HAST)
  → rehype-katex      (수식 렌더링)
  → rehype-highlight  (코드 syntax highlighting)
  → rehype-react      (HAST → React 컴포넌트)
```

### 테마 시스템

테마는 TypeScript 객체로 정의하고, CSS Variables로 런타임 적용합니다. `src/renderer/themes/` 디렉토리에서 폰트, 색상, 간격 등을 독립적으로 수정할 수 있습니다.

### 보안

- `contextIsolation: true` — Renderer는 Node.js에 직접 접근 불가
- `nodeIntegration: false` — Renderer에서 require() 불가
- `sandbox: true` — Renderer 프로세스 샌드박스
- CSP 헤더 설정
- 파일 경로 디렉토리 탈출 차단

## 라이선스

MIT
