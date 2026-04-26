# Pinch Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트랙패드 핀치 제스처로 페이지(본문 + Mermaid 다이어그램 포함) 전체를 1배~5배까지 시각적으로 확대할 수 있게 한다.

**Architecture:** Electron 메인 프로세스의 `createWindow` 안 기존 `did-finish-load` 핸들러에 `webContents.setVisualZoomLevelLimits(1, 5)` 호출 한 줄을 추가한다. Chromium 네이티브 visual zoom을 활성화하는 단순 변경이며 렌더러나 IPC는 건드리지 않는다.

**Tech Stack:** Electron 33 (`BrowserWindow`, `webContents`).

**Spec:** `docs/superpowers/specs/2026-04-26-pinch-zoom-design.md`

**Note:** 사용자 명시 요청에 따라 자동화 테스트(Vitest, Playwright)는 작성하지 않는다. CLAUDE.md Development Loop의 RED/E2E 단계는 건너뛴다. 검증은 사용자 수동 회귀로 대체된다.

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/main/main.ts` | 메인 프로세스 / `BrowserWindow` 생성 | 수정 (`did-finish-load` 핸들러 첫 줄에 호출 추가) |

다른 파일은 수정하지 않는다.

---

## Task 1: Enable visual pinch zoom on window load

CLAUDE.md Development Loop의 PICK 단위 기능: "트랙패드 핀치줌 활성화". `setVisualZoomLevelLimits`는 페이지가 로드될 때마다 리셋되므로 매 로드 후 다시 호출해야 하며, 기존 `did-finish-load` 핸들러에 합쳐서 추가 리스너 없이 처리한다.

**Files:**
- Modify: `src/main/main.ts:35-41`

### Steps

- [ ] **Step 1: Add visual zoom limit call**

`src/main/main.ts:35-41`의 `did-finish-load` 핸들러 본문 첫 줄에 `setVisualZoomLevelLimits(1, 5)` 호출을 추가한다.

변경 전:
```ts
  win.webContents.on('did-finish-load', () => {
    openFileQueue.setSender((filePath) => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:open-file', filePath);
      }
    });
  });
```

변경 후:
```ts
  win.webContents.on('did-finish-load', () => {
    void win.webContents.setVisualZoomLevelLimits(1, 5);
    openFileQueue.setSender((filePath) => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:open-file', filePath);
      }
    });
  });
```

`setVisualZoomLevelLimits`는 `Promise<void>`를 반환하므로 `void`로 무시한다. webContents가 destroyed 상태에서 호출되어도 추가 처리는 필요 없다 — 줌 활성화가 안 될 뿐 부수효과가 없다.

- [ ] **Step 2: Lint**

Run:
```bash
pnpm lint
```

Expected: 위반 0건. (한 줄 추가이므로 lint 이슈가 발생할 가능성은 매우 낮다. trailing space 없음, 들여쓰기 일관 확인.)

- [ ] **Step 3: TypeScript / electron-vite build**

Run:
```bash
pnpm build
```

Expected: 빌드 성공. 메인 번들에 변경사항이 포함되어야 한다.

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts
git commit -m "feat(zoom): enable trackpad pinch zoom up to 5x

Chromium의 visual zoom은 BrowserWindow 기본값에서 비활성화 상태라
트랙패드 핀치 제스처가 무시되었다. did-finish-load에서
setVisualZoomLevelLimits(1, 5)를 호출해 1~5배 핀치줌을 활성화한다.
Mermaid SVG 등 본문 콘텐츠 전체에 적용된다.

Spec: docs/superpowers/specs/2026-04-26-pinch-zoom-design.md
"
```

- [ ] **Step 5: Build app**

Run:
```bash
pnpm run build:app
```

Expected: macOS 앱 패키징 성공. 사용자가 패키징된 앱을 실행해 핀치 제스처를 수동 검증한다.

---

## Self-Review Checklist (작성자 셀프)

- ✅ Spec 결정사항 모두 커버: 방식(visual zoom), max=5, 호출 시점(`did-finish-load`), 영향 파일(`main.ts` 단일).
- ✅ Placeholder 없음 — 모든 step에 정확한 명령/코드 포함.
- ✅ 타입/시그니처 일관성: `setVisualZoomLevelLimits(min: number, max: number)`은 Electron API와 일치.
- ✅ 비목표 명시 준수: 자동화 테스트 작성 안 함, Mermaid 전용 줌 UI 만들지 않음.
