---
name: tdd-workflow
description: >
  TDD Red-Green-Refactor 사이클 실행. 테스트 작성부터 구현,
  리팩토링, 린트, 커밋까지의 전체 워크플로우 강제.
---

# TDD Workflow

## 트리거
- 새 기능 구현 시
- 버그 수정 시
- 리팩토링 시 (기존 테스트 확인 후 진행)

## 워크플로우 — 반드시 이 순서

### 1. Red — 실패하는 테스트 작성
- Vitest로 `describe`/`it`/`expect` 작성
- 테스트 파일: `tests/` 디렉토리에 `*.test.ts` 또는 `*.spec.ts`
- `pnpm test` 실행 → **실패 확인** (실패하지 않으면 테스트가 잘못된 것)
- 테스트는 구현하려는 동작을 명확히 설명해야 함

### 2. Green — 최소한의 코드로 통과
- 테스트를 통과하는 **가장 간단한** 코드 작성
- 함수형 스타일: 순수 함수, `const`, 선언적 표현
- "최소한" = 현재 테스트를 통과시키는 코드만. 미래를 위한 코드 금지
- `pnpm test` 실행 → **통과 확인**

### 3. Refactor — 코드 정리
- 중복 제거, 함수 추출, 네이밍 개선
- **새 기능 추가 금지** — 구조 개선만
- `pnpm test` 실행 → **통과 유지 확인**

### 4. Lint — 코드 품질 확인
- `pnpm lint` 실행 → **위반 0건 확인**
- 위반 발견 시 수정 후 테스트 재실행

### 5. Commit — Atomic Commit
- `atomic-commit` 스킬에 따라 커밋
- 커밋 메시지: `test(scope): add tests for X` 또는 `feat(scope): implement X`

### 6. E2E 테스트 (UI 변경 시)
- UI 관련 변경이 있으면 Playwright Electron 테스트 추가
- `pnpm test:e2e` 실행 → 통과 확인

## 금지 사항
- ❌ 테스트 없이 구현 코드 먼저 작성
- ❌ 한 사이클에 여러 기능 동시 구현
- ❌ 테스트 통과에 필요 없는 코드 작성 (과도한 코드)
- ❌ try-catch로 테스트를 억지로 통과시키는 트릭
- ❌ 테스트를 건너뛰고 "나중에 추가" 약속

## 체크리스트
- [ ] 테스트 먼저 작성했는가?
- [ ] `pnpm test` 실패 확인했는가? (Red)
- [ ] 최소한의 코드로 통과시켰는가? (Green)
- [ ] 리팩토링 후 테스트 재확인했는가? (Refactor)
- [ ] `pnpm lint` 위반 0건인가?
- [ ] atomic commit으로 커밋했는가?
