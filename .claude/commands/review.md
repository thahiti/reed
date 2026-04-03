---
name: review
description: 현재 변경사항에 대한 코드 리뷰 실행.
---

# /review — 코드 리뷰

## 사용법
```
/review          # 현재 staged + unstaged 변경사항 리뷰
/review HEAD~3   # 최근 3개 커밋 리뷰
```

## 실행
@code-reviewer 서브에이전트를 호출하여 다음을 검토합니다:

1. 함수형 스타일 준수
2. 최소 코드 / YAGNI 준수
3. 방어 코드 검출
4. TypeScript 타입 안전성
5. Electron 보안
6. 린트 위반

결과: APPROVE / APPROVE WITH NOTES / REQUEST CHANGES
