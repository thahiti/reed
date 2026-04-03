# MDViewer — Design Spec

## 아키텍처

### 프로세스 분리

```
Main Process (Node.js)
├── 파일 읽기 (fs)
├── 파일 이력 관리 (electron-store)
├── 파일 경로 해석
├── 시스템 테마 감지
├── 앱 메뉴
└── File Association / open-file 이벤트

Preload Script (contextBridge)
└── window.api — 최소 API 노출

Renderer Process (React)
├── 마크다운 렌더링 파이프라인
├── 탭 관리
├── Quick Open 모달
└── 테마 적용
```

### 디렉토리 구조

```
src/
├── main/
│   ├── main.ts              # 앱 엔트리, BrowserWindow 생성
│   ├── menu.ts              # 앱 메뉴 정의
│   └── ipc/
│       ├── fileHandlers.ts  # file:read, file:open-dialog, file:resolve-path
│       ├── historyHandlers.ts # history:get, history:add
│       └── themeHandlers.ts # theme:get-system, theme:on-change
├── preload/
│   └── preload.ts           # contextBridge API 노출
├── renderer/
│   ├── index.html
│   ├── index.tsx            # React 엔트리
│   ├── App.tsx              # 탭 관리 + 테마 적용
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── MarkdownView.tsx # 마크다운 렌더링 컨테이너
│   │   ├── QuickOpen.tsx    # Cmd+P 퍼지 검색 모달
│   │   ├── Welcome.tsx      # 빈 상태 화면
│   │   └── markdown/        # 마크다운 요소별 컴포넌트
│   │       ├── Heading.tsx
│   │       ├── Paragraph.tsx
│   │       ├── CodeBlock.tsx
│   │       ├── InlineCode.tsx
│   │       ├── Table.tsx
│   │       ├── Blockquote.tsx
│   │       ├── List.tsx
│   │       ├── Image.tsx
│   │       ├── Link.tsx
│   │       ├── Divider.tsx
│   │       ├── Checkbox.tsx
│   │       └── MermaidDiagram.tsx
│   ├── hooks/
│   │   ├── useMarkdown.ts   # 마크다운 파이프라인 훅
│   │   ├── useTabs.ts       # 탭 상태 관리
│   │   ├── useTheme.ts      # 테마 상태 + 시스템 연동
│   │   └── useQuickOpen.ts  # 퍼지 검색 로직
│   ├── themes/
│   │   ├── types.ts         # Theme 타입 정의
│   │   ├── light.ts         # 라이트 테마
│   │   ├── dark.ts          # 다크 테마
│   │   └── applyTheme.ts    # CSS Variables 적용 함수
│   ├── pipeline/
│   │   └── createProcessor.ts # unified 파이프라인 생성
│   └── styles/
│       ├── global.css       # CSS Variables 참조 기본 스타일
│       └── fonts.css        # @font-face 선언
└── shared/
    └── types.ts             # IPC 채널 타입 정의
```

## 테마 시스템

### Theme 타입

```typescript
type Theme = {
  readonly name: string;
  readonly fonts: {
    readonly body: string;
    readonly code: string;
    readonly bodySize: string;
    readonly codeSize: string;
    readonly lineHeight: string;
    readonly codeLineHeight: string;
  };
  readonly colors: {
    readonly bg: string;
    readonly text: string;
    readonly textSecondary: string;
    readonly heading: string;
    readonly link: string;
    readonly linkHover: string;
    readonly codeBg: string;
    readonly codeText: string;
    readonly blockquoteBg: string;
    readonly blockquoteBorder: string;
    readonly blockquoteText: string;
    readonly tableBorder: string;
    readonly tableHeaderBg: string;
    readonly tableStripeBg: string;
    readonly divider: string;
    readonly selection: string;
  };
  readonly spacing: {
    readonly paragraph: string;
    readonly headingMarginTop: string;
    readonly headingMarginBottom: string;
    readonly contentMaxWidth: string;
    readonly contentPadding: string;
  };
  readonly headingScale: {
    readonly h1: string;
    readonly h2: string;
    readonly h3: string;
    readonly h4: string;
    readonly h5: string;
    readonly h6: string;
  };
};
```

### 적용 방식
- `applyTheme(theme: Theme)` → document.documentElement에 CSS Variables 설정
- 모든 컴포넌트는 CSS Variables를 참조
- 시스템 테마 변경 시 `nativeTheme.on('updated')` → IPC → `useTheme` 훅 → 테마 전환

## 마크다운 렌더링 파이프라인

```
markdown string
  → remark-parse          (마크다운 → mdast)
  → remark-gfm            (테이블, 체크리스트, 취소선)
  → remark-math            (수식 구문 추출)
  → remark-rehype          (mdast → hast)
  → rehype-katex           (수식 → HTML)
  → rehype-highlight       (코드 syntax highlighting)
  → rehype-react           (hast → React 컴포넌트)
       ↓
  커스텀 컴포넌트 매핑:
    h1~h6  → <Heading>
    p      → <Paragraph>
    pre    → <CodeBlock>    (mermaid 언어 감지 → <MermaidDiagram>)
    code   → <InlineCode>
    table  → <Table>
    blockquote → <Blockquote>
    ul/ol  → <List>
    li     → <ListItem>
    img    → <Image>
    a      → <Link>
    hr     → <Divider>
    input[checkbox] → <Checkbox>
```

## IPC 채널 정의

```typescript
type IpcChannels = {
  'file:read': { args: readonly [filePath: string]; return: string };
  'file:open-dialog': { args: readonly []; return: string | null };
  'file:resolve-path': { args: readonly [basePath: string, relativePath: string]; return: string };
  'file:open-external': { args: readonly [url: string]; return: void };
  'history:get': { args: readonly []; return: ReadonlyArray<HistoryEntry> };
  'history:add': { args: readonly [filePath: string]; return: void };
  'theme:get-system': { args: readonly []; return: 'light' | 'dark' };
};

type HistoryEntry = {
  readonly filePath: string;
  readonly fileName: string;
  readonly openedAt: string; // ISO 8601
};
```

이벤트 (main → renderer):
- `theme:on-change` → `'light' | 'dark'`
- `app:open-file` → `string` (파일 경로)

### 이미지 로컬 파일 보안
- Main process에서 `file:resolve-path` 처리 시 경로 검증
- 마크다운 파일이 위치한 디렉토리 기준으로 상대 경로만 허용
- `../../../etc/passwd` 같은 디렉토리 탈출 차단 (resolved path가 base directory 내에 있는지 검증)
- Renderer에서는 `custom-protocol://` 스킴으로 로컬 이미지 로드 (file:// 직접 접근 차단)

## 탭 상태

```typescript
type Tab = {
  readonly id: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly content: string;
};

type TabState = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
};
```

## Quick Open

- `Cmd+P`로 모달 열기
- `history:get`으로 최근 파일 목록 가져오기 (시간 역순)
- `fuse.js`로 파일명/경로 퍼지 매칭
- Enter로 선택한 파일을 새 탭에서 열기
- Esc로 닫기

## 폰트

| 용도 | 폰트 | 포맷 |
|------|------|------|
| 영문 본문 | Inter | woff2, 번들 |
| 한글 본문 | Pretendard | woff2, 번들 |
| 코드 | JetBrains Mono | woff2, 번들 |

fallback:
- 본문: `Inter, Pretendard, -apple-system, system-ui, sans-serif`
- 코드: `'JetBrains Mono', 'SF Mono', Menlo, monospace`

## 코드 블록 Syntax Highlighting

- `rehype-highlight` + `highlight.js`
- 테마: GitHub 스타일 (라이트/다크 각각)
- 코드 블록 우측 상단에 언어 라벨 표시

## 기술 스택

### 런타임
- Electron 33+
- React 19
- TypeScript (strict)

### 마크다운
- unified, remark-parse, remark-gfm, remark-math
- remark-rehype, rehype-katex, rehype-highlight, rehype-react
- mermaid

### 유틸
- fuse.js (퍼지 검색)
- electron-store (이력 저장)
- @fontsource/inter, @fontsource/jetbrains-mono, pretendard

### 빌드
- electron-vite

### 테스트
- Vitest + @testing-library/react (단위)
- Playwright (e2e)
