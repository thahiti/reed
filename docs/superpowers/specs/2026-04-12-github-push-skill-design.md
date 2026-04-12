# github-push 스킬 설계

## 개요

현재 git 상태를 자동 감지하여 GitHub에 push하는 사용자 범위 스킬(`~/.claude/skills/github-push/SKILL.md`). remote가 없으면 GitHub 리포를 생성하고, uncommitted changes가 있으면 경고 후 중단한다.

## 실행 플로우

```
1. 사전 검증
   └─ uncommitted changes 확인 → 있으면 경고 + 중단 (atomic-commit 유도)

2. remote 상태 감지
   ├─ remote 있음 → 4로 이동
   └─ remote 없음 → 3으로 이동

3. GitHub 리포 생성
   ├─ 리포 이름: 프로젝트 메타 파일에서 추론 → 사용자 확인
   ├─ visibility: public (기본값)
   ├─ description: 프로젝트 내용에서 추론 → 사용자에게 제안 (생략 가능)
   ├─ `gh repo create` 실행
   └─ remote origin 자동 추가

4. Push
   ├─ upstream 설정 여부 확인
   ├─ 없으면: `git push -u origin <branch>`
   └─ 있으면: `git push`
```

## 리포 이름/설명 추론 로직

다음 소스를 우선순위 순으로 확인:

1. `package.json`의 `name` / `description`
2. `README.md`의 제목(H1) / 첫 단락
3. `Cargo.toml`, `pyproject.toml` 등 언어별 메타 파일
4. 현재 디렉토리 이름 (fallback)

추론된 이름과 설명을 사용자에게 보여주고 확인을 받은 뒤 생성한다.

## 도구 의존성

- `gh` CLI (GitHub CLI) — 리포 생성 및 인증
- `git` — 기본 git 명령

## 사용자 확인 시점

| 시점 | 확인 여부 |
|------|----------|
| uncommitted changes 발견 | 경고 + 중단 (atomic-commit 유도) |
| 리포 생성 (이름/설명) | 확인 필요 |
| push 실행 | 확인 없이 실행 |

## 스킬 위치

`~/.claude/skills/github-push/SKILL.md` (사용자 범위, 모든 프로젝트에서 사용 가능)

## 스킬 트리거

사용자가 GitHub에 push하려 할 때, 또는 `/github-push`로 직접 호출할 때 실행.
