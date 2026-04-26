# Pinch Zoom — 설계 문서

- 작성일: 2026-04-26
- 상태: 승인 대기
- 스코프: 트랙패드 핀치 제스처로 페이지(본문 + Mermaid 다이어그램 포함) 전체를 시각적으로 확대할 수 있게 한다.

## 배경

현재 `Cmd +/-`(Electron menu role `zoomIn`/`zoomOut`)로 page zoom은 동작하지만, 트랙패드 핀치 제스처에는 아무 응답이 없다. 원인은 Electron의 `BrowserWindow`가 visual zoom(Chromium 핀치줌)을 기본 비활성화한 채 출발하기 때문이다. 활성화하려면 `webContents.setVisualZoomLevelLimits(min, max)`를 명시적으로 호출해야 한다.

특히 Mermaid 다이어그램의 경우 `dangerouslySetInnerHTML`로 SVG를 본문에 인라인하기 때문에 별도의 줌 UI가 없으며, 큰 시퀀스 다이어그램·ER 다이어그램의 세부를 들여다볼 수단이 없다.

### 비목표

- Mermaid 다이어그램 전용 인라인 줌·팬 UI (svg-pan-zoom 등)
- 다이어그램 클릭 시 모달로 펼쳐 보기
- 핀치 제스처를 page zoom(`zoomFactor`)에 매핑 (텍스트 reflow가 필요한 경우)
- 줌 상태 영속화(파일 전환·새로고침 후에도 유지)
- 자동화된 핀치 제스처 회귀 테스트 (수동 검증으로 대체)

## 결정사항

| 항목 | 값 | 이유 |
|---|---|---|
| 방식 | Visual zoom (Chromium 네이티브) | 가장 단순. Mermaid SVG는 벡터라 확대 화질 손실이 없음 |
| 최대 배율 | 5배 | Chromium 허용 최대치. 복잡한 Mermaid 다이어그램의 세부 확인 가능 |
| 최소 배율 | 1배 | Chromium 제약상 1 미만 불가. 변경 여지 없음 |
| 호출 시점 | `webContents.did-finish-load` | `setVisualZoomLevelLimits`는 페이지 로드마다 리셋되므로 매 로드 후 재설정 필요. 기존 핸들러에 합쳐 추가 리스너 없이 처리 |

### 트레이드오프 (수용된 항목)

- visual zoom은 픽셀 단순 확대이므로 **고배율에서 텍스트가 흐려질 수 있다**. Mermaid 다이어그램 확대가 주 목적이므로 수용.
- visual zoom은 page zoom(`Cmd +/-`)과 별개 메커니즘이라 둘이 곱해질 수 있다. 사용자가 명시적으로 두 방식을 모두 사용할 때만 발생하므로 의도된 동작으로 수용.
- 새 파일을 열거나 페이지를 새로고침하면 줌이 1배로 리셋된다. visual zoom 본질에 따른 동작이며, 임시적 확대 용도로 적합.

## 아키텍처

### 변경되는 모듈

| 파일 | 변경 |
|---|---|
| `src/main/main.ts` | `createWindow` 내 기존 `did-finish-load` 핸들러에 `setVisualZoomLevelLimits(1, 5)` 호출 추가 |

다른 파일은 수정하지 않는다. Mermaid 컴포넌트, preload, renderer, 메뉴, 설정 모두 무관.

### 코드 변경 (예상)

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

`setVisualZoomLevelLimits`는 `Promise<void>`를 반환하므로 `void`로 무시한다. 실패 시(예: webContents가 이미 destroyed) 추가 처리 없이 무시한다 — 윈도우 라이프사이클상 거의 발생하지 않으며 발생해도 줌 활성화가 안 될 뿐 다른 부수효과 없음.

## 검증

- **수동 회귀**: 앱 빌드 후 트랙패드 두 손가락 핀치 → 페이지 확대 확인. Mermaid 다이어그램이 포함된 마크다운 파일에서 다이어그램이 함께 확대되는지 확인. 5배까지 확대되는지 확인. 새 파일을 열면 1배로 돌아가는지 확인.
- **자동화 테스트 없음**: 사용자 요청에 따라 단위/e2e 테스트 작성하지 않는다. 변경 범위가 한 줄이고 동작 책임은 Chromium에 있어 단위테스트의 가치가 낮다.

## 보안 영향

없음. `setVisualZoomLevelLimits`는 Chromium의 시각적 확대 한계만 조정하며, `contextIsolation`/`nodeIntegration`/CSP에 영향 없음.
