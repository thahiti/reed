---
name: tdd-workflow
description: >
  단위 기능 추출 → TDD Red-Green-Refactor → E2E → Commit → Build 루프.
  계획에서 하나의 기능을 명시적으로 꺼내고, 테스트 주도로 구현하며,
  완료 시 반드시 커밋과 빌드를 수행한다.
---

# TDD Workflow

## 핵심 원칙
**하나의 단위 기능 = 하나의 루프 = 하나의 커밋.**
여러 기능을 한 번에 구현하거나, 커밋 없이 다음 기능으로 넘어가는 것을 금지한다.

## 루프 — 반드시 이 순서

### 1. PICK — 단위 기능 선택
- 개발 계획(PLAN.md)에서 다음 단위 기능 1개를 선택
- **명시적으로 선언**: "지금부터 [기능명]을 구현합니다"
- 해당 기능에 필요한 파일, 테스트 파일을 미리 파악

### 2. RED — 실패하는 테스트 작성
- Vitest로 `describe`/`it`/`expect` 작성
- 테스트 파일: `tests/` 디렉토리에 `*.test.ts` 또는 `*.spec.ts`
- `pnpm test` 실행 → **실패 확인**
- 실패하지 않으면 테스트가 잘못된 것 → 수정

### 3. GREEN — 최소한의 코드로 통과
- 테스트를 통과하는 **가장 간단한** 코드 작성
- 함수형 스타일: 순수 함수, `const`, 선언적 표현
- "최소한" = 현재 테스트를 통과시키는 코드만
- `pnpm test` 실행 → **통과 확인**

### 4. REFACTOR — 코드 정리
- 중복 제거, 함수 추출, 네이밍 개선
- **새 기능 추가 금지** — 구조 개선만
- `pnpm test` 실행 → **통과 유지 확인**

### 5. LINT — 코드 품질 확인
- `pnpm lint` 실행 → **위반 0건 확인**
- 위반 발견 시 수정 후 테스트 재실행

### 6. E2E — Playwright 테스트 (UI 변경 시)
- UI 관련 변경이 있으면 **반드시** Playwright Electron 테스트 추가/수정
- `pnpm build && pnpm test:e2e` 실행 → **통과 확인**
- E2E 테스트 판단 기준:
  - 새 컴포넌트 추가 → E2E 추가
  - 기존 UI 동작 변경 → E2E 수정
  - 순수 로직/타입 변경 → E2E 불필요

```typescript
// tests/e2e/feature.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';

const appPath = resolve(__dirname, '../../out/main/main.js');

test('should [expected behavior]', async () => {
  const app = await electron.launch({ args: [appPath] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 검증
  await expect(page.locator('.selector')).toBeVisible();

  await app.close();
});
```

### 7. COMMIT — Atomic Commit
- `atomic-commit` 스킬에 따라 커밋
- 커밋 메시지: `feat(scope): implement X` 또는 `fix(scope): fix X`
- 테스트 + 구현 + E2E = 1 커밋 (같은 논리적 단위)

### 8. BUILD — 앱 빌드
- `pnpm run build:app` 실행
- 빌드 실패 시 수정 후 재빌드

### 9. NEXT — 다음 기능
- 1번으로 돌아가 다음 단위 기능 선택
- 모든 기능 완료 시 종료

## 금지 사항
- ❌ 테스트 없이 구현 코드 먼저 작성
- ❌ 한 루프에 여러 기능 동시 구현
- ❌ 커밋 없이 다음 기능으로 넘어가기
- ❌ 테스트 통과에 필요 없는 코드 작성 (과도한 코드)
- ❌ try-catch로 테스트를 억지로 통과시키는 트릭
- ❌ 빌드 없이 작업 완료 선언
- ❌ squash-merge로 atomic commit 히스토리 소실

## 체크리스트 (매 루프마다)
- [ ] 단위 기능을 명시적으로 선언했는가?
- [ ] 테스트 먼저 작성했는가? (Red)
- [ ] `pnpm test` 실패 확인했는가?
- [ ] 최소한의 코드로 통과시켰는가? (Green)
- [ ] 리팩토링 후 테스트 재확인했는가?
- [ ] `pnpm lint` 위반 0건인가?
- [ ] UI 변경이면 E2E 테스트를 추가/수정했는가?
- [ ] atomic commit으로 커밋했는가?
- [ ] `pnpm run build:app`으로 빌드했는가?
