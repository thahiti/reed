---
name: electron-conventions
description: >
  Electron 앱 코드 작성 시 프로젝트 컨벤션 적용.
  함수형 스타일, IPC 패턴, 보안, 프로세스 분리 포함.
---

# Electron Conventions

## 함수형 프로그래밍 패턴

### 핵심 원칙
- 순수 함수 우선: 같은 입력 → 같은 출력, 부수효과 없음
- `const` 기본. `let`은 명확한 이유가 있을 때만
- `Readonly<T>`, `ReadonlyArray<T>` 적극 사용
- `map`/`filter`/`reduce`/`flatMap` 우선 — `for`/`while` 대신 선언적 표현

### 부수효과 격리
- 부수효과는 시스템 경계(IPC, 파일, 네트워크)에 격리
- 비즈니스 로직은 순수 함수로 작성
- 부수효과가 있는 함수는 명확히 분리하고 이름으로 표현

### 합성과 추상화
- 고차 함수, 클로저, 합성(composition) 활용
- 상속 대신 합성. `class` 최소화, 필요 시에도 composition 우선
- pipe/flow 패턴으로 데이터 변환 체인 구성

## 최소 코드 / 방어 코드 금지

### YAGNI
- 현재 요구사항에 없는 추상화, 인터페이스를 미리 만들지 않음
- Rule of Three: 3번째 반복 시에만 추상화 도입

### 에러 처리
- `try-catch`는 실제 복구 가능한 에러에만 사용
- 로깅만을 위한 catch 금지
- 에러는 발생 지점 가까이에서 의미 있게 처리. 중간에서 삼키지 않음

### 타입 시스템 활용
- `unknown` + type narrowing으로 런타임 검증 최소화
- Optional chaining (`?.`)으로 충분한 곳에 별도 null 체크 불필요
- 타입 시스템이 보장하는 것을 런타임에 다시 검증하지 않음

## Electron 프로세스 분리

### Main Process
- Node.js API, 파일 시스템, 시스템 통합 담당
- BrowserWindow 생성 및 관리
- 앱 생명주기 관리

### Preload Script
- contextBridge로 최소 API만 노출
- renderer에서 사용할 함수만 선별적으로 expose
- Node.js API 직접 노출 금지

### Renderer Process
- 순수 프론트엔드 코드만
- Node.js API 직접 접근 불가
- preload에서 노출된 API만 사용

## IPC 패턴 — Typed IPC

### 채널 타입 정의
```typescript
// src/shared/types.ts
type IpcChannels = {
  'app:get-version': { args: readonly []; return: string };
  'file:read': { args: readonly [path: string]; return: string };
  'file:write': { args: readonly [path: string, content: string]; return: boolean };
};
```

### Main Process Handler
```typescript
// src/main/ipc/handlers.ts
import { ipcMain } from 'electron';
import type { IpcChannels } from '../../shared/types';

const registerHandler = <K extends keyof IpcChannels>(
  channel: K,
  handler: (...args: IpcChannels[K]['args']) => Promise<IpcChannels[K]['return']>,
): void => {
  ipcMain.handle(channel, (_event, ...args) =>
    handler(...(args as IpcChannels[K]['args'])),
  );
};
```

### Preload
```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels } from '../shared/types';

const createApi = () => ({
  invoke: <K extends keyof IpcChannels>(
    channel: K,
    ...args: IpcChannels[K]['args']
  ): Promise<IpcChannels[K]['return']> =>
    ipcRenderer.invoke(channel, ...args),
});

contextBridge.exposeInMainWorld('api', createApi());
```

## Electron 보안 체크리스트
- [ ] `contextIsolation: true`
- [ ] `nodeIntegration: false`
- [ ] `sandbox: true`
- [ ] CSP 헤더 설정
- [ ] `webSecurity: true` (기본값 유지)
- [ ] 원격 모듈(remote) 미사용
- [ ] `shell.openExternal` URL 검증
- [ ] 사용자 입력 sanitize (특히 파일 경로)

## 파일 구조 규칙
- `src/main/` — Main process 코드
- `src/main/ipc/` — IPC 핸들러
- `src/preload/` — Preload 스크립트
- `src/renderer/` — Renderer process (React)
- `src/shared/` — 프로세스 간 공유 타입/유틸
- `tests/` — 테스트 파일
