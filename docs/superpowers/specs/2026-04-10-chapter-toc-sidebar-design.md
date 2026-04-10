# Chapter TOC Sidebar — Design Spec

작성일: 2026-04-10

## 목적

마크다운 문서의 헤딩 목록(TOC)을 토글 가능한 사이드바로 제공한다. 사용자는 단축키 또는 메뉴로 TOC를 열고 닫으며, 항목을 클릭해 본문의 해당 섹션으로 이동한다. 스크롤에 따라 현재 보이는 헤딩이 자동으로 하이라이트된다.

## 범위

- **포함**: TOC 추출, 사이드바 UI, 단축키/메뉴 토글, 활성 헤딩 추적, 설정(위치·레벨·폭), 접근성.
- **제외 (YAGNI)**:
  - TOC 트리 접기/펼치기
  - TOC 항목으로 본문 섹션 숨기기
  - 드래그 리사이즈
  - 가시성 상태를 settings.json에 지속 저장 (세션 내 유지만)

## 사용자 시나리오

1. 사용자가 `.md` 파일을 연다.
2. `Cmd+Shift+O`를 누르면 화면 오른쪽(기본)에 TOC 사이드바가 나타난다.
3. 본문을 스크롤하면 현재 보이는 섹션의 항목이 하이라이트된다.
4. TOC 항목을 클릭하면 본문이 해당 헤딩으로 스무스 스크롤한다.
5. 다시 `Cmd+Shift+O` 또는 메뉴에서 `View → Toggle Outline` 클릭 시 숨겨진다.
6. `settings.json`의 `toc.position`을 `"left"`로 바꾸고 재시작하면 왼쪽에 나타난다.

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
│   └─ tocConfig: settings 구독 (position, minLevel, maxLevel, width)
│
└─ 렌더 트리
    App
     ├─ TabBar
     ├─ (position==='left' && tocVisible) && <Toc />
     ├─ MarkdownView
     └─ (position==='right' && tocVisible) && <Toc />
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
| `src/renderer/components/Toc.tsx` | 사이드바 컴포넌트 |
| `src/renderer/components/Toc.css` | 스타일 |
| `src/renderer/hooks/useActiveHeading.ts` | IntersectionObserver 기반 활성 id 추적 |
| `src/shared/types/toc.ts` | `TocHeading` 타입 |

### 수정

| 파일 | 변경 내용 |
|---|---|
| `src/renderer/pipeline/createProcessor.ts` | 파이프라인에 `rehypeCollectHeadings` 추가, 반환 타입 확장 |
| `src/renderer/hooks/useMarkdown.ts` | `{ rendered, headings }` 반환 |
| `src/renderer/App.tsx` | `tocVisible` 상태, Toc 렌더 분기, 메뉴 IPC 리스너 |
| `src/renderer/hooks/useSettings.ts` | `toc` 섹션 기본값 병합 및 검증 |
| `src/main/menu.ts` | `View → Toggle Outline` 메뉴 아이템 + accelerator |
| `src/main/keybindings.ts` | `toc.toggle` 액션 등록 |
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
  readonly width: number;
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
    "width": 260,           // px
    "visible": false        // 시작 시 표시 여부
  },
  "keybindings": {
    "toc.toggle": "Cmd+Shift+O"
  }
}
```

### 검증 규칙

- `position`이 `"left"`/`"right"` 외 값이면 `"right"`로 폴백
- `minLevel > maxLevel`이면 두 값을 스왑
- `width`는 `[120, 600]`으로 clamp
- `visible` 비불리언이면 `false`로 폴백

## 메뉴 / 단축키 / IPC

### Electron 메뉴 (main process)

```
View
 └─ Toggle Outline    <accelerator from keybindings.toc.toggle>
```

- `click` 핸들러가 `webContents.send('menu:toc-toggle')`을 발행
- accelerator는 `keybindings` 로딩 시점에 메뉴를 재빌드하여 반영 (기존 `file-reload-keybindings` 작업 패턴과 동일)

### Preload API

```ts
// src/preload/index.ts
onTocToggle(handler: () => void): () => void  // unsubscribe 반환
```

### Renderer

```ts
useEffect(() => {
  return window.api.onTocToggle(() => setTocVisible(v => !v));
}, []);
```

**단일 경로 원칙**: 단축키도 메뉴 accelerator를 통해서만 동작한다. 렌더러에서 별도로 키 이벤트를 듣지 않는다. 설정 변경 시 메뉴 재빌드로 자동 반영된다.

## 컴포넌트 상세

### Toc.tsx

```ts
type Props = {
  readonly headings: readonly TocHeading[];
  readonly activeId: string | null;
  readonly position: 'left' | 'right';
  readonly width: number;
  readonly onItemClick: (id: string) => void;
};
```

- 루트: `<aside className={`toc toc-${position}`} style={{ width }}>`
- 각 항목은 `<button data-level={level}>` — 텍스트 링크보다 button 사용(scrollIntoView 수동 제어, 기본 링크 네비 방지)
- `aria-current="location"`을 `activeId` 일치 항목에 부여
- 빈 headings: `"No headings"` placeholder 표시

### useActiveHeading

```ts
function useActiveHeading(headingIds: readonly string[]): string | null
```

- `IntersectionObserver`로 문서 내 `#<id>` 요소를 관찰
- `rootMargin: "0px 0px -70% 0px"` — 상단 30% 영역에 들어온 헤딩을 활성으로 간주
- 여러 개 교차 시: 가장 위쪽(먼저 등장) 헤딩의 id 반환
- `headingIds` 변경 시 observer를 disconnect 후 재생성 (탭 전환 / 문서 변경 대응)
- 관찰 대상이 없으면 `null` 반환

### CSS 요점

- `.toc { overflow-y: auto; border-left/right: 1px solid var(--border); background: var(--sidebar-bg); }`
- 레벨별 들여쓰기: `.toc button[data-level="3"] { padding-left: 1rem }` 등
- 활성 항목: `.toc button[aria-current="location"] { background: var(--accent-bg); font-weight: 600 }`

## 테스트 전략

### 단위 (Vitest)

1. **`rehypeCollectHeadings.test.ts`**
   - 마크다운 → 올바른 `{level, id, text}[]`
   - 헤딩 없는 문서 → 빈 배열
   - 인라인 코드/강조 포함 시 텍스트 평탄화
   - `Heading.tsx:toAnchorId`와 id 일치

2. **`useMarkdown.test.ts`** (기존 확장)
   - 반환값에 `headings` 포함

3. **`Toc.test.tsx`** (RTL)
   - 항목 렌더, `data-level` 속성
   - 클릭 시 `onItemClick(id)` 호출
   - `activeId` 일치 항목에 `aria-current="location"`
   - 빈 headings placeholder 렌더

4. **`useActiveHeading.test.ts`**
   - IntersectionObserver mock으로 교차 이벤트 → 올바른 id 반환
   - `headingIds` 변경 시 observer 재생성

5. **`settings.test.ts`** (확장)
   - position 폴백, minLevel/maxLevel 스왑, width clamp

### E2E (Playwright — `toc.spec.ts`)

1. 파일 열기 → `Cmd+Shift+O` → TOC 가시화
2. 항목 클릭 → 본문이 해당 헤딩으로 스크롤
3. 다시 `Cmd+Shift+O` → TOC 숨김
4. 스크롤 이동 → `aria-current` 변경 확인
5. settings.json에 `toc.position: "left"` 세팅 후 재시작 → 왼쪽 표시 확인

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
- `width` 드래그 리사이즈는 도입하지 않는다. 필요 시 settings.json만 수정.
- 활성 헤딩 하이라이트의 `rootMargin` 값은 실사용 후 조정 가능한 매직 넘버다. 필요 시 설정화는 후속 작업으로.
