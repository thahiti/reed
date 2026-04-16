# Vim-style Search Redesign

## Summary

기존 검색 기능을 Vim의 검색 워크플로우와 동일하게 재설계한다.
`/`로 검색 → `Enter`로 확정 → `n`/`N`으로 탐색 → `Escape`로 종료.
검색바를 좌하단(Vim command line 위치)으로 이동하고, 확정 후에도 검색어와 카운트를 인디케이터로 표시한다.

## Motivation

현재 검색의 문제점:

1. `Enter`/`Shift+Enter`로만 매치 탐색 가능 — 검색바가 열려있어야 함
2. 검색바를 닫으면(`Escape`) 하이라이트가 사라져 `n`/`N` 재탐색 불가
3. 텍스트 노드당 첫 번째 매치만 찾는 버그 (indexOf 1회 호출)

## Design

### State Machine

검색은 3개의 명시적 상태(phase)로 관리한다.

```
        /              Enter           /
idle ──────► inputting ──────► confirmed
  ▲            │                  │  ▲
  │          Escape             Escape│
  │            │                  │   │
  │            ▼                  ▼   │
  └──── (scrollTop 복귀) ◄───── idle  │
                                      │
                               n/N ───┘
```

#### State Definition

```typescript
type SearchPhase = 'idle' | 'inputting' | 'confirmed';

type SearchState = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matches: ReadonlyArray<Element>;
  readonly currentIndex: number;
  readonly savedScrollTop: number;
};
```

#### Transition Rules

| Current | Event | Next | Action |
|---------|-------|------|--------|
| idle | `/` | inputting | scrollTop 저장, 검색바(입력) 표시 |
| inputting | typing | inputting | 실시간 하이라이트 + 첫 매치로 스크롤 |
| inputting | `Enter` | confirmed | 입력창 닫고 인디케이터 표시 |
| inputting | `Enter` (빈 쿼리) | idle | 확정할 내용 없음, idle로 복귀 |
| inputting | `Escape` | idle | 하이라이트 제거, savedScrollTop으로 복귀 |
| confirmed | `n` | confirmed | 다음 매치, 카운트 업데이트 |
| confirmed | `N` (Shift+n) | confirmed | 이전 매치, 카운트 업데이트 |
| confirmed | `/` | inputting | 기존 하이라이트 제거, 현재 scrollTop 저장, 새 검색 시작 |
| confirmed | `Escape` | idle | 하이라이트 제거, 현재 스크롤 위치 유지 (복귀 아님) |

### Component Structure

#### SearchBar

하나의 `SearchBar` 컴포넌트가 phase에 따라 두 가지 모드를 렌더링한다.

```
inputting:  /search query█                        3/10
confirmed:  /search query                         3/10
idle:       (렌더링 없음)
```

- **위치**: 좌하단 고정 (`position: absolute; bottom: 0; left: 0`)
- **inputting**: `/` 프리픽스 + 텍스트 입력 + 매치 카운트. 입력에 포커스
- **confirmed**: 읽기 전용 텍스트로 검색어와 카운트 표시
- **idle**: 렌더링 없음
- 기존 ▲▼✕ 버튼 제거 — 키보드 전용 조작
- 매치 0건: "No matches" 표시

#### Props

```typescript
type SearchBarProps = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matchCount: number;
  readonly currentIndex: number;
  readonly onSearch: (query: string) => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
};
```

### useSearch Hook

#### Return Type

```typescript
type UseSearchReturn = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matchCount: number;
  readonly currentIndex: number;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
  readonly confirmSearch: () => void;
  readonly search: (query: string) => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
};
```

#### Key Changes

1. **`highlightMatches` bug fix** — `indexOf` 1회 → 반복 루프로 텍스트 노드 내 모든 매치를 찾음. 뒤에서부터 처리하여 인덱스 밀림 방지.

2. **`openSearch`** — `savedScrollTop = container.scrollTop` 저장.

3. **`confirmSearch` (새로 추가)** — phase를 `confirmed`로 전이. 빈 쿼리면 idle로 복귀. 하이라이트와 매치 배열 유지.

4. **`closeSearch` — phase에 따른 분기**:
   - `inputting` → idle: 하이라이트 제거 + savedScrollTop으로 복귀
   - `confirmed` → idle: 하이라이트 제거 + 현재 스크롤 유지

5. **`nextMatch` / `prevMatch`** — 기존 로직 동일.

### Keybinding Changes (MarkdownView)

| Key | Current | After |
|-----|---------|-------|
| `/` | `openSearch()` | 동일 (idle, confirmed 모두) |
| `n` | `nextMatch()` 항상 | `confirmed`일 때만 |
| `N` | `prevMatch()` 항상 | `confirmed`일 때만 |
| `Enter` | SearchBar 내부에서 nextMatch | `confirmSearch()` |
| `Escape` | SearchBar 내부에서 closeSearch | 동일 |

`inputting` 상태에서 `n`/`N`은 일반 문자 입력으로 동작 (검색어에 포함).

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| 매치 0건에서 Enter | confirmed 전이, "No matches" 인디케이터 |
| confirmed + 매치 0건 + `n`/`N` | 아무 동작 없음 |
| 빈 문자열에서 Enter | idle로 복귀 |
| confirmed에서 `/` → 같은 검색어 → Enter | 새로운 검색으로 매치 재계산 |
| 탭 전환 | idle로 초기화 (DOM 교체로 하이라이트 자연 소멸) |
| 편집 모드 전환 | idle로 초기화 |

## Files to Change

- `src/renderer/hooks/useSearch.ts` — 상태 머신 기반 재설계
- `src/renderer/components/SearchBar.tsx` — 두 모드 렌더링, 좌하단 배치
- `src/renderer/components/MarkdownView.tsx` — 키바인딩 분기 변경
- `src/renderer/styles/` — 검색바 CSS 좌하단 이동
- `tests/renderer/hooks/useSearch.test.ts` — 상태 전이 테스트 재작성

## Test Strategy

### Unit Tests (Vitest)

1. **State transitions** — 각 phase 간 전이 검증
   - idle → inputting → confirmed → idle
   - idle → inputting → idle (Escape)
   - confirmed → inputting → confirmed (재검색)
2. **highlightMatches bug fix** — 텍스트 노드 내 다중 매치 검증
   - "the cat and the dog" + "the" → 2 matches
   - "aaa" + "a" → 3 matches
3. **scrollTop save/restore** — inputting Escape → 복귀, confirmed Escape → 유지
4. **Empty query Enter** → idle 복귀

### E2E Tests (Playwright)

1. `/` → 타이핑 → 실시간 하이라이트
2. Enter → 인디케이터 전환
3. `n`/`N` → 매치 이동 + 카운트 업데이트
4. Escape → 하이라이트 제거
