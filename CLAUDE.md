# MDViewer

## Quick Reference
- Framework: Electron 33+ (Chromium + Node.js)
- Language: TypeScript (strict mode)
- Renderer: React
- Build: electron-vite
- Test: Vitest (unit) + Playwright (e2e)
- Lint: ESLint + Prettier (PostToolUse hook 자동 실행)
- Package Manager: pnpm

## Build & Run
- `pnpm dev` — 개발 서버 실행
- `pnpm build` — 프로덕션 빌드
- `pnpm test` — Vitest 테스트 실행
- `pnpm test:e2e` — Playwright e2e 테스트
- `pnpm lint` — ESLint 검사
- `pnpm lint:fix` — ESLint 자동 수정

## Coding Philosophy — IMPORTANT
- **함수형 프로그래밍 스타일**: 순수 함수 우선, 부수효과 격리, immutable 데이터 선호
- **최소 코드 원칙**: 작동하게 만드는 최소한의 코드만 작성. YAGNI 준수
- **과도한 방어 코드 금지**: 발생하지 않는 에러를 방어하지 말 것.
  타입 시스템으로 해결할 수 있으면 런타임 검증 대신 타입으로 해결
- 불필요한 try-catch 금지. 에러는 발생 지점에서 가장 가까운 의미 있는 곳에서만 처리
- 추상화는 3번째 반복이 발생했을 때 도입 (Rule of Three)

## TypeScript Standards
- strict: true, noUncheckedIndexedAccess: true
- `const` 우선, 필요 시 `let`. `var` 금지
- `as` 타입 단언 금지 — type guard 또는 제네릭으로 해결
- `any` 금지 — `unknown` + narrowing 사용
- 함수형: `map`/`filter`/`reduce` 우선, `for` 루프 대신 선언적 표현
- camelCase (변수/함수), PascalCase (타입/클래스/컴포넌트)

## Electron Security — YOU MUST FOLLOW
- contextIsolation: true (절대 false 금지)
- nodeIntegration: false (절대 true 금지)
- IPC는 반드시 preload + contextBridge 경유
- CSP 헤더 설정 필수
- 원격 모듈(remote) 사용 금지

## Development Loop — YOU MUST FOLLOW

개발 계획의 단위 기능을 하나씩 꺼내서 아래 루프를 반복한다.
**여러 기능을 한 번에 구현하거나, 루프를 건너뛰는 것을 금지한다.**

```
┌─ 1. PICK: 계획에서 다음 단위 기능 1개를 명시적으로 선택
│      → "지금부터 [기능명]을 구현합니다" 선언
│
├─ 2. RED: 실패하는 테스트 작성
│      → `pnpm test` 실패 확인
│
├─ 3. GREEN: 테스트를 통과하는 최소한의 코드 작성
│      → `pnpm test` 통과 확인
│
├─ 4. REFACTOR: 코드 정리 → 테스트 재확인
│
├─ 5. LINT: `pnpm lint` 위반 0건 확인
│
├─ 6. E2E: UI 변경이 있으면 Playwright 테스트 추가
│      → `pnpm build && pnpm test:e2e` 통과 확인
│
├─ 7. COMMIT: 이 단위 기능에 대한 atomic commit 생성
│      → 하나의 커밋 = 하나의 단위 기능
│
├─ 8. BUILD: `pnpm run build:app` 실행하여 앱 빌드
│
└─ 9. NEXT: 1번으로 돌아가 다음 단위 기능 선택
```

### 금지 사항
- ❌ 테스트 없이 구현 코드 먼저 작성
- ❌ 한 루프에 여러 기능 동시 구현
- ❌ 커밋 없이 다음 기능으로 넘어가기
- ❌ squash-merge로 atomic commit 히스토리 소실시키기
- ❌ 빌드 없이 작업 완료 선언

## Commit Rules (요약)
- Conventional Commits: feat/fix/test/refactor/docs/style/chore
- 하나의 커밋 = 하나의 논리적 변경. 상세: atomic-commit 스킬 참조
- 시크릿, node_modules, dist 커밋 금지
- feature 브랜치 머지 시 rebase-merge 사용 (squash-merge 금지)

## Subagent Delegation
- 구현 완료 후 커밋 전: @code-reviewer로 리뷰
- TDD 사이클 진행: @tdd-runner에 위임 가능 (단, 각 단위 기능마다 개별 커밋 필수)
- PR 생성 전 최종 검증: @qa-evaluator로 품질 평가

## UI 디버깅
- `--remote-debugging-port=9333`으로 앱 실행 → agent-browser로 스크린샷/DOM 검사
- 또는 Playwright로 Electron 앱 직접 테스트

## Context Management
- compact 시 보존: 현재 작업 파일 목록, 테스트 상태, 미완료 항목
- 작업 전환 시 /clear 사용
