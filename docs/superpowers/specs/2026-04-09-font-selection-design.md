# Font Selection: 본문/코드 폰트 메뉴 선택 기능

## Overview

Reed 마크다운 뷰어의 기본 본문 폰트를 SUIT로 변경하고, View 메뉴에서 본문 폰트와 코드 폰트를 선택할 수 있는 기능을 추가한다.

## 폰트 목록

### 본문 폰트

| ID | 이름 | font-family | 소스 | 기본값 |
|---|---|---|---|---|
| `suit` | SUIT | `'SUIT Variable', sans-serif` | npm `suit` | ✅ |
| `pretendard` | Pretendard | `'Pretendard Variable', sans-serif` | npm `pretendard` (기존) | |
| `noto-serif-kr` | Noto Serif KR | `'Noto Serif KR', serif` | npm `@fontsource/noto-serif-kr` | |
| `kopub-batang` | KoPub Batang | `'KoPubBatang', serif` | 직접 번들 (woff2) | |

### 코드 폰트

| ID | 이름 | font-family | 소스 | 기본값 |
|---|---|---|---|---|
| `jetbrains-mono` | JetBrains Mono | `'JetBrains Mono', monospace` | npm `@fontsource/jetbrains-mono` (기존) | ✅ |
| `d2coding` | D2Coding | `'D2Coding', monospace` | 직접 번들 (woff2) | |
| `nanumgothic-coding` | Nanum Gothic Coding | `'Nanum Gothic Coding', monospace` | npm `@fontsource/nanum-gothic-coding` | |

## 데이터 모델

### AppSettings 확장

```typescript
type AppSettings = {
  readonly scroll: ScrollSettings;
  readonly bodyFont?: string;   // 폰트 ID. 미설정 시 'suit'
  readonly codeFont?: string;   // 폰트 ID. 미설정 시 'jetbrains-mono'
  readonly lightTheme?: ThemeOverrides;
  readonly darkTheme?: ThemeOverrides;
  readonly keybindings?: Partial<Record<string, string>>;
};
```

### 폰트 레지스트리

`src/shared/fonts.ts`에 상수로 정의:

```typescript
type FontEntry = {
  readonly id: string;
  readonly name: string;
  readonly family: string;
};

const bodyFonts: ReadonlyArray<FontEntry> = [...];
const codeFonts: ReadonlyArray<FontEntry> = [...];
const defaultBodyFont = 'suit';
const defaultCodeFont = 'jetbrains-mono';
```

조회 함수: ID → font-family 문자열 반환.

## 테마 적용 흐름

```
AppSettings.bodyFont / codeFont
  → 폰트 레지스트리에서 family 조회
  → Theme.fonts.body / Theme.fonts.code 덮어쓰기
  → applyTheme() → CSS 변수 설정
```

기존 `ThemeOverrides.fonts.body`가 설정되어 있으면 그것이 우선 (하위 호환성).

## 메뉴 구조

View 메뉴에 서브메뉴 추가:

```
View
├─ Toggle Edit Mode
├─ ───────────────
├─ Body Font ▸
│   ├─ ● SUIT
│   ├─   Pretendard
│   ├─   Noto Serif KR
│   └─   KoPub Batang
├─ Code Font ▸
│   ├─ ● JetBrains Mono
│   ├─   D2Coding
│   └─   Nanum Gothic Coding
├─ ───────────────
├─ Previous Tab
├─ ...
```

- `type: 'radio'`로 현재 선택 표시
- 클릭 시 `menu:set-body-font` / `menu:set-code-font` 이벤트를 renderer로 전송 (폰트 ID 포함)

## 이벤트 흐름

```
메뉴 클릭
  → main: webContents.send('menu:set-body-font', fontId)
  → renderer: settings 업데이트 (settings:set IPC)
  → renderer: 테마 재적용 (새 폰트 family로)
```

설정은 electron-store에 저장. 앱 재시작 후에도 유지.

## 폰트 CSS 로딩

모든 폰트의 `@font-face`를 `fonts.css`에서 항상 선언한다. font-family에 지정되지 않은 폰트는 브라우저가 실제 파일을 다운로드하지 않으므로 성능 영향 없음.

- Inter @import 제거 (더 이상 사용하지 않음)
- SUIT, Noto Serif KR, Nanum Gothic Coding: npm @import
- KoPub Batang, D2Coding: `src/renderer/assets/fonts/`에 woff2 번들 + @font-face 선언

## 변경 파일

### 신규

| 파일 | 내용 |
|---|---|
| `src/shared/fonts.ts` | 폰트 레지스트리 상수 및 조회 함수 |
| `src/renderer/assets/fonts/` | KoPub Batang, D2Coding woff2 파일 |

### 수정

| 파일 | 변경 |
|---|---|
| `src/shared/types.ts` | AppSettings에 `bodyFont?`, `codeFont?` 추가 |
| `src/renderer/styles/fonts.css` | 폰트 @import/@font-face 추가/제거 |
| `src/renderer/themes/light.ts` | 기본 body를 SUIT로 변경 |
| `src/renderer/themes/dark.ts` | 기본 body를 SUIT로 변경 |
| `src/renderer/hooks/useSettings.ts` | 폰트 설정 → 테마 주입 로직 |
| `src/renderer/App.tsx` | 메뉴 이벤트 핸들러 추가 |
| `src/main/menu.ts` | View 메뉴에 Body Font / Code Font 서브메뉴 |
| `package.json` | suit, @fontsource/noto-serif-kr, @fontsource/nanum-gothic-coding 추가 |

### 변경하지 않는 파일

- `applyTheme.ts` — CSS 변수 설정 로직 그대로
- `MarkdownEditor.tsx` — `--font-code` 변수 참조로 자동 반영
- `preload.ts` — 변경 불필요
