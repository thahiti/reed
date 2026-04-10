# Chapter TOC Overlay — Design Spec

작성일: 2026-04-10

## 목적

마크다운 문서의 헤딩 목록(TOC)을 본문 위에 떠 있는 투명 오버레이로 제공한다. 읽기 모드에서 단축키로 토글하며, 항목 클릭 시 본문의 해당 섹션으로 스크롤한다. 스크롤 위치에 따라 현재 보이는 헤딩이 자동 하이라이트된다.

## 범위

- **포함**: TOC 추출, 투명 오버레이 UI, 읽기 모드 전용 단축키/메뉴 토글, 활성 헤딩 추적, 설정(위치·레벨), 접근성.
- **제외 (YAGNI)**:
  - TOC 트리 접기/펼치기
  - TOC 항목으로 본문 섹션 숨기기
  - 편집 모드에서의 토글
  - ESC / 바깥 클릭으로 닫기
  - 가시성 상태를 settings.json에 지속 저장 (세션 내 유지만)

## 사용자 시나리오

1. 사용자가 `.md` 파일을 읽기 모드에서 연다.
2. `O` 키를 누르면 화면 오른쪽(기본)에 TOC 텍스트 오버레이가 본문 위에 나타난다. 본문 레이아웃은 변하지 않는다.
3. 본문을 스크롤하면 현재 보이는 섹션의 항목이 파란색으로 하이라이트된다.
4. TOC 항목을 클릭하면 본문이 해당 헤딩으로 스무스 스크롤한다.
5. 다시 `O` 또는 메뉴에서 `View → Toggle Outline` 클릭 시 숨겨진다.
6. 편집 모드에서는 `O` 키가 텍스트로 입력되며 TOC 토글은 작동하지 않는다.
7. `settings.json`의 `toc.position`을 `"left"`로 바꾸고 재시작하면 왼쪽에 나타난다.

## 아키텍처

```
┌─ createProcessor.ts
│   └─ + rehypeCollectHeadings (신규 플러그인)
│         hast 방문 → headings: {level, id, text}[]
│         file.data.headings 에 저장
│
├─ useMarkdown hook
│   └─ { rendered, headings } 반환
│
├─ App.tsx (상태 추가)
│   ├─ tocVisible: boolean (세션 내 전역)
│   └─ tocConfig: settings 구독 (position, minLevel, maxLevel)
│
└─ 렌더 트리 (오버레이는 본문 위에 position:absolute)
    App (position: relative)
     ├─ TabBar
     ├─ MarkdownView (전체 폭)
     └─ (tocVisible && !isEditMode) && <TocOverlay position=... />
```

### 데이터 흐름

1. 마크다운 로드 → `useMarkdown`이 unified 파이프라인 실행
2. `rehypeCollectHeadings`가 hast에서 `h1..h6` 노드를 순회하여 `{level, id, text}` 수집
3. `useMarkdown`이 `{ rendered, headings }` 반환
4. App에서 `minLevel ≤ level ≤ maxLevel`로 필터링 후 `<Toc>`에 전달
5. `useActiveHeading`이 IntersectionObserver로 활성 id 추적
6. Toc 클릭 → `document.getElementById(id).scrollIntoView({ behavior:'smooth', block:'start' })`

### ID 일관성

현재 `Heading.tsx`는 렌더 시점에 텍스트로부터 `toAnchorId()`를 호출해 id를 계산한다. TOC와 본문 헤딩의 id가 반드시 일치해야 `scrollIntoView`가 동작한다. 이를 위해:

1. `toAnchorId(text: string): string` 함수를 `src/renderer/pipeline/anchorId.ts`로 추출 (현재 `Heading.tsx`에 있는 것을 이동)
2. `rehypeCollectHeadings`는 각 heading 노드의 자식을 순회해 평탄 텍스트를 추출한 뒤 동일한 `toAnchorId`를 호출해 id를 계산
3. `Heading.tsx`도 추출된 동일 함수를 import하여 사용

두 경로가 동일 함수 + 동일 hast 텍스트 입력을 사용하므로 id 일치가 보장된다.

## 신규/수정 파일

### 신규

| 파일 | 역할 |
|---|---|
| `src/renderer/pipeline/anchorId.ts` | `toAnchorId(text)` 공용 함수 (Heading.tsx에서 추출) |
| `src/renderer/pipeline/rehypeCollectHeadings.ts` | hast 방문자, `file.data.headings` 채움 |
| `src/renderer/components/TocOverlay.tsx` | 투명 오버레이 컴포넌트 |
| `src/renderer/components/TocOverlay.css` | 오버레이 스타일 |
| `src/renderer/hooks/useActiveHeading.ts` | IntersectionObserver 기반 활성 id 추적 |
| `src/shared/types/toc.ts` | `TocHeading` 타입 |

### 수정

| 파일 | 변경 내용 |
|---|---|
| `src/renderer/pipeline/createProcessor.ts` | 파이프라인에 `rehypeCollectHeadings` 추가, 반환 타입 확장 |
| `src/renderer/hooks/useMarkdown.ts` | `{ rendered, headings }` 반환 |
| `src/renderer/App.tsx` | `tocVisible` 상태, TocOverlay 렌더 분기, 읽기 모드 체크, 메뉴 IPC 리스너 |
| `src/renderer/hooks/useSettings.ts` | `toc` 섹션 기본값 병합 및 검증 |
| `src/main/menu.ts` | `View → Toggle Outline` 메뉴 아이템 + accelerator |
| `src/shared/keybindings.ts` | `view:toggle-toc` 액션 추가 |
| `src/preload/index.ts` | `onTocToggle` API 노출 |

## 타입

```ts
// src/shared/types/toc.ts
export type TocHeading = {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly id: string;
  readonly text: string;
};

export type TocConfig = {
  readonly position: 'left' | 'right';
  readonly minLevel: 1 | 2 | 3 | 4 | 5 | 6;
  readonly maxLevel: 1 | 2 | 3 | 4 | 5 | 6;
  readonly visible: boolean;
};
```

## 설정 스키마

```jsonc
{
  "toc": {
    "position": "right",   // "left" | "right"
    "minLevel": 2,          // 1..6
    "maxLevel": 4,          // 1..6
    "visible": false        // 시작 시 표시 여부
  },
  "keybindings": {
    "view:toggle-toc": "O"
  }
}
```

### 검증 규칙

- `position`이 `"left"`/`"right"` 외 값이면 `"right"`로 폴백
- `minLevel > maxLevel`이면 두 값을 스왑
- `visible` 비불리언이면 `false`로 폴백

## 메뉴 / 단축키 / IPC

기존 `view:toggle-edit` (단축키 `T`) 패턴을 그대로 따른다 — 메뉴 accelerator + 렌더러 keydown 리스너 병행, 입력 포커스 시 무시.

### Electron 메뉴 (main process)

```
View
 └─ Toggle Outline    <accelerator from keybindings['view:toggle-toc']>
```

- `click` 핸들러가 `webContents.send('menu:toggle-toc')`을 발행
- accelerator는 keybindings 로딩 시점에 메뉴 재빌드하여 반영 (`view:toggle-edit`와 동일 패턴)

### Preload API

```ts
// src/preload/index.ts
onTocToggle(handler: () => void): () => void  // unsubscribe 반환
```

### Renderer 동작

두 경로에서 토글 가능:

1. **메뉴/accelerator 경로**: main → `menu:toggle-toc` IPC → 렌더러 핸들러 → `setTocVisible(v => !v)`
2. **렌더러 keydown 경로**: `App.tsx`의 글로벌 keydown 리스너에서 `view:toggle-toc` 바인딩을 매칭

두 경로 모두 **동일한 가드 조건**을 거친다:

```ts
const target = e.target as HTMLElement;
const isInputFocused =
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.classList.contains('cm-content');
if (!isInputFocused && !isEditMode) {
  setTocVisible(v => !v);
}
```

**읽기 모드 전용**: `isEditMode === true`이거나 입력 요소가 포커스된 상태면 토글이 무시된다. 편집 모드에서 `O` 키는 일반 텍스트로 입력된다.

**주의**: 메뉴 accelerator가 단일 문자 `O`로 등록되면 읽기 모드에서도 항상 발화되어 메뉴 경로를 탄다. 편집 모드에서는 CodeMirror가 키를 먼저 처리하므로 accelerator가 발화되지 않도록 `view:toggle-edit`와 동일한 방식으로 처리된다(기존 코드 참고).

## 컴포넌트 상세

### TocOverlay.tsx

```ts
type Props = {
  readonly headings: readonly TocHeading[];
  readonly activeId: string | null;
  readonly position: 'left' | 'right';
  readonly onItemClick: (id: string) => void;
};
```

- 루트: `<aside className={`toc-overlay toc-overlay-${position}`}>`
- 헤더/라벨/단축키 표시 없음 — 항목 텍스트만 렌더
- 각 항목은 `<button data-level={level}>` — scrollIntoView 수동 제어, 링크 네비 방지
- `aria-current="location"`을 `activeId` 일치 항목에 부여
- `aria-label="Document outline"`을 루트에 부여 (라벨이 시각적으로 없으므로 접근성 보조)
- 빈 headings: 컴포넌트를 렌더하지 않음 (빈 오버레이 표시 안 함)

### useActiveHeading

```ts
function useActiveHeading(headingIds: readonly string[]): string | null
```

- `IntersectionObserver`로 문서 내 `#<id>` 요소를 관찰
- `rootMargin: "0px 0px -70% 0px"` — 상단 30% 영역에 들어온 헤딩을 활성으로 간주
- 여러 개 교차 시: 가장 위쪽(먼저 등장) 헤딩의 id 반환
- `headingIds` 변경 시 observer disconnect 후 재생성 (탭 전환 / 문서 변경 대응)
- 관찰 대상이 없으면 `null` 반환

### CSS 요점 (TocOverlay.css)

```css
.toc-overlay {
  position: absolute;
  top: 52px;
  width: 220px;
  max-height: calc(100% - 84px);
  overflow-y: auto;
  font-size: 12px;
  z-index: 5;
  /* 본문 이벤트 차단 */
  pointer-events: auto;
  /* 스크롤바 숨김 */
  scrollbar-width: none;
  background: transparent;
  border: none;
  padding: 0;
}
.toc-overlay::-webkit-scrollbar { display: none; }
.toc-overlay-right { right: 20px; }
.toc-overlay-left  { left: 20px; }

.toc-overlay button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 0;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  line-height: 1.5;
  /* 가독성 보조 — 본문과 겹칠 때 */
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.6);
}
.toc-overlay button:hover  { color: rgba(255, 255, 255, 0.9); }
.toc-overlay button[aria-current="location"] {
  color: #4a9eff;
  font-weight: 600;
}
.toc-overlay button[data-level="3"] { padding-left: 14px; font-size: 11px; }
.toc-overlay button[data-level="4"] { padding-left: 28px; font-size: 11px; }
```

**다크/라이트 테마 대응**: 위 색상들은 CSS 변수(`var(--toc-text)`, `var(--toc-active)` 등)로 치환하고 기존 테마 시스템의 변수 네이밍 규칙에 맞춰 선언한다. 라이트 테마에서는 `text-shadow`를 흰색 반투명으로 변경해 가독성을 유지한다.

**본문 이벤트 차단**: `pointer-events: auto` + `z-index: 5`로 오버레이 영역의 본문 클릭/텍스트 선택을 TOC가 가로챈다.

## 테스트 전략

### 단위 (Vitest)

1. **`rehypeCollectHeadings.test.ts`**
   - 마크다운 → 올바른 `{level, id, text}[]`
   - 헤딩 없는 문서 → 빈 배열
   - 인라인 코드/강조 포함 시 텍스트 평탄화
   - `Heading.tsx:toAnchorId`와 id 일치

2. **`useMarkdown.test.ts`** (기존 확장)
   - 반환값에 `headings` 포함

3. **`TocOverlay.test.tsx`** (RTL)
   - 항목 렌더, `data-level` 속성
   - 클릭 시 `onItemClick(id)` 호출
   - `activeId` 일치 항목에 `aria-current="location"`
   - 빈 headings일 때 컴포넌트 렌더 안 됨
   - 루트에 `aria-label="Document outline"` 존재

4. **`useActiveHeading.test.ts`**
   - IntersectionObserver mock으로 교차 이벤트 → 올바른 id 반환
   - `headingIds` 변경 시 observer 재생성

5. **`settings.test.ts`** (확장)
   - position 폴백, minLevel/maxLevel 스왑, visible 비불리언 폴백

### E2E (Playwright — `toc.spec.ts`)

1. 읽기 모드에서 파일 열기 → `O` → TOC 오버레이 가시화
2. 항목 클릭 → 본문이 해당 헤딩으로 스크롤
3. 다시 `O` → TOC 숨김
4. 스크롤 이동 → `aria-current` 변경 확인
5. 편집 모드 진입 → `O` 키 입력 → 본문에 "O" 문자가 삽입되고 TOC는 토글되지 않음
6. settings.json에 `toc.position: "left"` 세팅 후 재시작 → 왼쪽 표시 확인

## 구현 순서 (개략)

1. `toAnchorId` 함수 추출 (`Heading.tsx` → `anchorId.ts`) + 기존 테스트 유지
2. 타입 + `rehypeCollectHeadings` + 단위 테스트
3. `useMarkdown` 확장
4. `useSettings` 검증 로직 + 테스트
5. `Toc` 컴포넌트 + 테스트
6. `useActiveHeading` + 테스트
7. 메뉴/IPC/preload 배선
8. App.tsx 상태 및 렌더 통합
9. E2E 테스트
10. 빌드 확인

세부 단계는 별도 구현 계획 문서에서 TDD 루프 단위로 분해한다.

## 비고

- TOC 가시성은 세션 내 전역. 탭 전환 시 TOC는 활성 탭의 headings로 자동 갱신된다.
- 오버레이 폭은 고정 220px. 드래그 리사이즈 및 설정은 도입하지 않는다.
- 활성 헤딩 하이라이트의 `rootMargin` 값은 실사용 후 조정 가능한 매직 넘버다. 필요 시 설정화는 후속 작업으로.
- 편집 모드에서는 TOC가 무조건 숨겨지며, 읽기 모드로 돌아왔을 때 이전 가시성 상태가 유지된다 (세션 내).
