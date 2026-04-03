# MDViewer — Implementation Plan

## Phase 1: 프로젝트 초기화

### 1-1. Electron + Vite + React 스캐폴드
- `electron-vite` 프로젝트 초기화
- `tsconfig.json` (strict, noUncheckedIndexedAccess)
- `pnpm dev`, `pnpm build`, `pnpm test` 스크립트 설정
- ESLint + Prettier 의존성 설치 및 동작 확인

### 1-2. 디렉토리 구조 생성
- `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/` 구조 확립
- `src/main/ipc/` 디렉토리 생성
- 빈 BrowserWindow가 뜨는 최소 앱 동작 확인

### 1-3. IPC 타입 정의
- `src/shared/types.ts` — IpcChannels, HistoryEntry, Tab 타입 정의
- preload에서 contextBridge + typed API 노출
- 보안 설정 확인 (contextIsolation, nodeIntegration, sandbox, CSP)

## Phase 2: 테마 시스템

### 2-1. Theme 타입 및 기본 테마
- `src/renderer/themes/types.ts` — Theme 타입 정의
- `src/renderer/themes/light.ts` — 라이트 테마 값
- `src/renderer/themes/dark.ts` — 다크 테마 값

### 2-2. 테마 적용 메커니즘
- `src/renderer/themes/applyTheme.ts` — CSS Variables 설정 함수
- `src/renderer/hooks/useTheme.ts` — 시스템 테마 감지 + 자동 전환
- `src/main/ipc/themeHandlers.ts` — nativeTheme 연동 IPC

### 2-3. 폰트 번들링
- Inter, Pretendard, JetBrains Mono woff2 설치
- `src/renderer/styles/fonts.css` — @font-face 선언
- `src/renderer/styles/global.css` — CSS Variables 참조 기본 스타일

## Phase 3: 마크다운 렌더링

### 3-1. 렌더링 파이프라인 코어
- `src/renderer/pipeline/createProcessor.ts` — unified 파이프라인 조립
- remark-parse + remark-gfm + remark-rehype + rehype-react 기본 연결
- `src/renderer/hooks/useMarkdown.ts` — 마크다운 → React 변환 훅

### 3-2. 기본 마크다운 컴포넌트
- Heading, Paragraph, List, ListItem
- InlineCode, Blockquote, Divider
- Checkbox (읽기 전용)
- 각 컴포넌트에 테마 CSS Variables 적용

### 3-3. 테이블 컴포넌트
- Table, TableRow, TableCell
- 헤더 배경, 줄무늬, 정렬 지원
- 오버플로우 시 가로 스크롤

### 3-4. 코드 블록
- CodeBlock 컴포넌트 — rehype-highlight 연동
- GitHub 스타일 syntax highlighting (라이트/다크)
- 언어 라벨 표시
- 가로 스크롤

### 3-5. 이미지
- Image 컴포넌트
- 로컬 상대 경로 → IPC로 절대 경로 변환
- 외부 URL 직접 로드
- max-width: 100% 반응형

### 3-6. 링크
- Link 컴포넌트
- `.md` 상대 링크 → 새 탭에서 열기 (IPC 경유)
- 외부 URL → shell.openExternal
- `#anchor` → 문서 내 스크롤

### 3-7. 수식 (KaTeX)
- remark-math + rehype-katex 파이프라인 추가
- KaTeX CSS 번들
- 인라인(`$...$`) + 블록(`$$...$$`) 렌더링

### 3-8. Mermaid 다이어그램
- MermaidDiagram 컴포넌트
- 코드 블록 언어가 `mermaid`일 때 SVG 렌더링
- 다크/라이트 테마 연동

## Phase 4: 파일 열기 & 탭

### 4-1. 파일 읽기 IPC
- `src/main/ipc/fileHandlers.ts` — file:read, file:open-dialog, file:resolve-path
- 파일 읽기 → UTF-8 문자열 반환
- 에러 처리 (파일 없음, 권한 없음)

### 4-2. 탭 시스템
- `src/renderer/hooks/useTabs.ts` — 탭 상태 관리
- TabBar 컴포넌트 — 파일명, 닫기 버튼
- MarkdownView 컴포넌트 — 활성 탭의 마크다운 렌더링
- Welcome 컴포넌트 — 탭 없을 때 표시

### 4-3. 파일 열기 방식
- `Cmd+O` — 파일 선택 다이얼로그 → 새 탭
- Drag & Drop — 파일 드래그 → 새 탭
- File Association — `open-file` 이벤트 → 새 탭
- 탭 전환: `Cmd+1~9`, `Cmd+Shift+[/]`

### 4-4. 앱 메뉴
- `src/main/menu.ts` — File, View, Window 메뉴
- 단축키 바인딩

## Phase 5: Quick Open

### 5-1. 파일 이력 관리
- `src/main/ipc/historyHandlers.ts` — electron-store로 이력 저장/조회
- 파일 열 때마다 이력 추가 (시간 기록)
- 상한 100개, 오래된 순 삭제

### 5-2. Quick Open 모달
- QuickOpen 컴포넌트
- `Cmd+P`로 열기, `Esc`로 닫기
- fuse.js로 파일명/경로 퍼지 매칭
- 기본 정렬: 최근 열었던 시간 역순
- Enter → 선택 파일을 새 탭에서 열기
- 화살표 키로 항목 탐색

## Phase 6: 마무리

### 6-1. File Association 설정
- `electron-builder` 또는 `electron-forge` 설정
- `.md` 확장자 연결 (macOS plist)

### 6-2. E2E 테스트
- Playwright로 주요 시나리오 테스트
- 파일 열기 → 렌더링 확인
- 탭 전환
- Quick Open

### 6-3. 빌드 & 패키징
- macOS용 `.dmg` 빌드
- 코드 서명 (선택)
- 앱 아이콘
