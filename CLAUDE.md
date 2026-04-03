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

## TDD — YOU MUST FOLLOW
1. Red: 실패하는 테스트 작성 → `pnpm test` 실패 확인
2. Green: 테스트를 통과하는 최소한의 코드 작성
3. Refactor: 코드 정리 → 테스트 재확인
4. Lint: `pnpm lint` 위반 0건 확인
5. Commit: atomic commit 규칙에 따라 커밋
테스트 없이 구현 코드를 먼저 작성하지 말 것.

## Commit Rules (요약)
- Conventional Commits: feat/fix/test/refactor/docs/style/chore
- 하나의 커밋 = 하나의 논리적 변경. 상세: atomic-commit 스킬 참조
- 시크릿, node_modules, dist 커밋 금지

## Subagent Delegation
- 구현 완료 후 커밋 전: @code-reviewer로 리뷰
- TDD 사이클 진행: @tdd-runner에 위임 가능
- PR 생성 전 최종 검증: @qa-evaluator로 품질 평가

## UI 디버깅
- `--remote-debugging-port=9333`으로 앱 실행 → agent-browser로 스크린샷/DOM 검사
- 또는 Playwright로 Electron 앱 직접 테스트

## Context Management
- compact 시 보존: 현재 작업 파일 목록, 테스트 상태, 미완료 항목
- 작업 전환 시 /clear 사용
