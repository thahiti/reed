---
name: implement
description: 기능 구현. TDD 사이클 + 코드 리뷰 + 품질 평가 파이프라인 실행.
---

# /implement — 기능 구현 파이프라인

## 사용법
```
/implement <기능 설명>
```

## 파이프라인

### 1. 설계
- 요구사항 분석 및 테스트 케이스 도출
- 필요 시 Plan Mode에서 설계 논의

### 2. TDD 사이클 (@tdd-runner)
- Red → Green → Refactor → Lint → Commit 반복
- 매 사이클마다 atomic commit

### 3. 코드 리뷰 (@code-reviewer)
- 함수형 스타일, 최소 코드, 보안 검토
- Critical/High 이슈 발견 시 수정 후 재리뷰

### 4. 품질 평가 (@qa-evaluator)
- 10점 만점 평가
- 7점 이상 통과 시 PR 생성 가능

## 체크리스트
- [ ] 요구사항 명확히 정의됨
- [ ] TDD 사이클 완료 (모든 테스트 통과)
- [ ] 코드 리뷰 통과 (APPROVE)
- [ ] QA 평가 통과 (7점 이상)
- [ ] atomic commit 완료
