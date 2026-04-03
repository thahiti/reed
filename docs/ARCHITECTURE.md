# Architecture

## 프로세스 구조

```
┌─────────────────────────────────────────┐
│              Main Process               │
│  (Node.js + Electron APIs)              │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ main.ts │  │ ipc/     │  │ menu.ts│ │
│  └─────────┘  └──────────┘  └────────┘ │
└───────────────────┬─────────────────────┘
                    │ IPC (typed channels)
┌───────────────────┴─────────────────────┐
│            Preload Script               │
│  (contextBridge + ipcRenderer)          │
│                                         │
│  ┌──────────────┐                       │
│  │ preload.ts   │ → window.api 노출    │
│  └──────────────┘                       │
└───────────────────┬─────────────────────┘
                    │ window.api
┌───────────────────┴─────────────────────┐
│          Renderer Process               │
│  (React + TypeScript)                   │
│                                         │
│  ┌──────────────┐  ┌─────────────┐     │
│  │ Components   │  │ Hooks       │     │
│  └──────────────┘  └─────────────┘     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│             Shared                      │
│  (Types, Constants — 프로세스 간 공유)   │
└─────────────────────────────────────────┘
```

## 디렉토리 구조

```
src/
├── main/           # Main process
│   ├── main.ts     # 앱 엔트리포인트, BrowserWindow 생성
│   ├── ipc/        # IPC 핸들러
│   └── menu.ts     # 앱 메뉴
├── preload/
│   └── preload.ts  # contextBridge API 노출
├── renderer/       # Renderer process (React)
│   ├── index.html  # HTML 엔트리포인트
│   └── ...         # React 컴포넌트, 훅 등
└── shared/         # 프로세스 간 공유
    └── types.ts    # IPC 채널 타입, 공통 타입
```

## IPC 통신

모든 프로세스 간 통신은 typed IPC channel을 사용합니다.
`src/shared/types.ts`에 채널과 페이로드 타입을 정의하고,
Main/Preload/Renderer 각각에서 타입 안전하게 사용합니다.

## 보안 모델

- `contextIsolation: true` — Renderer는 Node.js에 직접 접근 불가
- `nodeIntegration: false` — Renderer에서 require() 불가
- `sandbox: true` — Renderer 프로세스 샌드박스
- CSP 헤더로 외부 스크립트/스타일 로드 차단
- preload에서 최소 API만 contextBridge로 노출
