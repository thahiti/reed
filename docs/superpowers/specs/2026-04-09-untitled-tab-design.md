# Untitled Tab: New Tab + Edit + Save As

## Overview

Reed 마크다운 뷰어에 새 탭을 열어 편집 모드에서 콘텐츠를 작성하고 저장하는 기능을 추가한다.

## 핵심 동작

1. 사용자가 새 탭을 연다 (`Cmd+N`, File 메뉴, 탭바 "+" 버튼)
2. "Untitled" 탭이 편집 모드로 즉시 열린다
3. 콘텐츠를 작성하거나 붙여넣는다
4. `Cmd+S` 시 Save As 다이얼로그가 표시된다
5. 저장 후 탭이 일반 파일 탭으로 전환된다

## 설계 결정

| 항목 | 결정 |
|---|---|
| Untitled 탭 식별 | `Tab.filePath === null` |
| 동시 Untitled 탭 수 | 최대 1개. 이미 있으면 포커스 이동 |
| 새 탭 진입 모드 | 자동 편집 모드 |
| 첫 저장 | Save As 네이티브 다이얼로그 |
| 저장 후 탭 변환 | filePath/fileName 설정, modified 해제, 파일 워칭 시작, 히스토리 추가 |
| 저장 후 편집 모드 | 유지 (편집 모드 그대로) |
| 닫기 정책 | 내용 없으면 즉시 닫기, 내용 있으면 확인 다이얼로그 (저장/저장 안 함/취소) |

## 데이터 모델

### Tab 타입 변경

```typescript
type Tab = {
  readonly id: string;
  readonly filePath: string | null;  // null = Untitled
  readonly fileName: string;          // Untitled 탭: "Untitled"
  readonly content: string;
  readonly modified: boolean;
};
```

`filePath === null`이 Untitled 탭을 판별하는 유일한 기준이다.

## useTabs 훅 변경

### 새 함수

**`createNewTab(): string`**
- Untitled 탭이 이미 존재하면 해당 탭으로 포커스 이동, 탭 ID 반환
- 없으면 `{ id: nextId, filePath: null, fileName: "Untitled", content: "", modified: false }` 생성
- `activeTabId`를 새 탭으로 설정
- 생성된(또는 기존) 탭 ID 반환

**`promoteTab(tabId: string, filePath: string, fileName: string): void`**
- Untitled 탭의 filePath, fileName을 설정
- modified를 false로 변경
- 일반 파일 탭으로 전환 완료

### 기존 함수

변경 없음: `openTab()`, `closeTab()`, `updateTabContent()`, `reloadTab()`, `markTabSaved()`.

## 저장 흐름

### handleSave() 분기

```
Cmd+S
  ├─ activeTab.filePath !== null → file:write 직접 저장 (기존)
  └─ activeTab.filePath === null → handleSaveAs()
```

### handleSaveAs()

1. `file:save-dialog` IPC 호출 → 네이티브 Save 다이얼로그 (기본 확장자: `.md`)
2. 취소 시 리턴
3. 경로 선택 시:
   - `file:write(filePath, content)`
   - `promoteTab(tabId, filePath, fileName)`
   - `file:watch(filePath)`
   - `history:add(filePath)`

## IPC 추가

| 채널 | 타입 | 인자 | 반환 | 핸들러 |
|---|---|---|---|---|
| `file:save-dialog` | invoke | — | `string \| null` | fileHandlers.ts |
| `dialog:confirm-close` | invoke | message: string | `number` (버튼 인덱스) | dialogHandlers.ts (신규) |

### file:save-dialog

`dialog.showSaveDialog`를 호출한다. 필터: `*.md`. 반환: 선택된 경로 또는 null.

### dialog:confirm-close

3버튼 다이얼로그: "저장", "저장 안 함", "취소". 클릭된 버튼의 인덱스를 반환한다.

## UI 트리거

### 새 탭 생성 (3가지)

| 트리거 | 구현 |
|---|---|
| `Cmd+N` | keybinding `file:new` 추가 |
| File 메뉴 "New" | `menu:new-file` 이벤트 → renderer에서 처리 |
| 탭바 "+" 버튼 | TabBar에 `onNewTab` prop 추가 |

세 트리거 모두 동일하게 `createNewTab()` + `setIsEditMode(true)` 실행.

### 닫기 확인 다이얼로그

```
탭 닫기 요청
  ├─ filePath !== null → 즉시 닫기 (기존)
  └─ filePath === null
       ├─ content === "" → 즉시 닫기
       └─ content !== "" → dialog:confirm-close
            ├─ 0 "저장" → handleSaveAs() → 성공 시 닫기
            ├─ 1 "저장 안 함" → 즉시 닫기
            └─ 2 "취소" → 닫기 취소
```

## 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `src/shared/types.ts` | `Tab.filePath`: `string` → `string \| null`, IpcChannels 확장 |
| `src/shared/keybindings.ts` | `file:new` 키바인딩 추가 |
| `src/renderer/hooks/useTabs.ts` | `createNewTab()`, `promoteTab()` 추가 |
| `src/renderer/App.tsx` | `handleNewTab()`, `handleSaveAs()`, 닫기 확인 로직, 이벤트 핸들링 |
| `src/renderer/components/TabBar.tsx` | "+" 버튼, `onNewTab` prop |
| `src/main/ipc/fileHandlers.ts` | `file:save-dialog` 핸들러 |
| `src/main/ipc/dialogHandlers.ts` | 신규 — `dialog:confirm-close` 핸들러 |
| `src/main/main.ts` | dialogHandlers 등록 |
| `src/main/menu.ts` | File > New 항목, `menu:new-file` 이벤트 |

## 변경하지 않는 파일

- `MarkdownEditor.tsx` — 기존 에디터 그대로 사용
- `MarkdownView.tsx` — 변경 없음
- `fileWatchHandlers.ts` — Untitled 탭에서 호출하지 않으므로 변경 불필요
- `QuickOpen.tsx` — 변경 없음
- `preload.ts` — 타입 기반 채널 허용으로 코드 변경 불필요할 가능성 높음
