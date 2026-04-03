---
name: atomic-commit
description: >
  코드 변경 후 커밋. Conventional Commits + atomic commit 원칙 적용.
  diff 크기 검증, 린트/테스트 통과 확인 후 커밋.
---

# Atomic Commit

## 원칙
- **하나의 커밋 = 하나의 논리적 변경**
- "and"로 설명해야 하면 커밋을 분리할 것
- 모든 커밋은 빌드와 테스트가 통과하는 상태를 유지

## 커밋 전 체크리스트
1. `git diff --stat` 확인 → **400줄 초과 시 분리 제안**
2. `pnpm test` → 통과 확인
3. `pnpm lint` → 위반 0건 확인
4. `pnpm build` → 빌드 성공 확인

## Conventional Commits 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type
| Type | 용도 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `test` | 테스트 추가/수정 |
| `refactor` | 기능 변경 없는 코드 구조 개선 |
| `docs` | 문서만 변경 |
| `style` | 포매팅, 공백 등 (로직 변경 없음) |
| `chore` | 빌드, 설정, 도구 등 유지보수 |
| `perf` | 성능 개선 |

### 규칙
- 제목: 최대 50자, 소문자, 마침표 없음, 명령형 ("add", not "added")
- 본문: 72자 줄바꿈, **why**를 설명 (how는 diff에서 보임), 한글로 설명
- 이슈 참조: footer에 `Closes #123`, `Refs #456`

### 좋은 예시
```
feat(layout): add BlockClusterer with adjacent bbox merging
test(classifier): add unit tests for HeadingRule font height thresholds
fix(ipc): handle file read timeout in main process
refactor(renderer): extract markdown parser to pure function
```

### 나쁜 예시
```
update code
fix bug and refactor utils and add tests
WIP
```

## 커밋 단위 기준
- 새 함수/메서드 추가 + 해당 테스트 → 1 커밋
- 버그 수정 1건 → 1 커밋
- 변수/함수 리네이밍 → 1 커밋
- 의존성 업데이트 → 1 커밋
- 설정 변경 → 1 커밋

## 커밋 타이밍
- 하나의 논리적 작업 단위를 완료했을 때
- 테스트가 통과한 직후 (Green → Commit)
- 작업 방향을 전환하기 전에
- 위험한 변경을 시도하기 전에 (안정 상태를 먼저 커밋)

## 절대 커밋 금지
- `.env`, API 키, 인증 정보 등 시크릿
- `node_modules/`, `dist/`, `.build/`, `DerivedData/`
- 생성된 파일 (`.pyc`, 빌드 산출물)

## 이상적인 diff 크기
- 목표: 10~100줄
- 100줄 초과 시 분리를 적극 고려
- 분리가 어려운 경우 본문에 이유 설명
