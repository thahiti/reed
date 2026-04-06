# Image Embedding Support Design

## Overview

마크다운 파일에 포함된 이미지 참조(`![alt](path)`)를 렌더링할 수 있도록 지원한다.

**지원 범위:**
- 로컬 상대경로 (`images/pic.png`, `./diagram.svg`)
- 로컬 절대경로 (`/Users/.../pic.png`)
- 외부 URL (`https://example.com/pic.png`)
- Data URI (`data:image/png;base64,...`)

**렌더링 방식:** 모든 이미지는 `<img>` 태그로 렌더링 (SVG 포함)

## Architecture

### 1. Custom Protocol (`md-image://`)

Main process에서 Electron `protocol.handle`로 등록한다.

**URL 형식:**
```
md-image:///Users/randy/docs/images/diagram.svg
```

**동작:**
- 요청 URL에서 절대 경로 추출
- 허용 확장자 검증: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`
- 경로 정규화 후 path traversal 방지
- 파일을 읽어 적절한 MIME type으로 응답

**보안:**
- 이미지 확장자 외 파일 접근 차단
- `normalize()`로 `../` 등 경로 조작 방지

### 2. Rehype Plugin (`rehypeImageResolve`)

unified 파이프라인에서 `rehype-react` 직전에 배치되는 rehype 플러그인.

**변환 규칙:**

| 입력 src | 변환 결과 |
|----------|----------|
| `https://...`, `http://...` | 그대로 유지 |
| `data:...` | 그대로 유지 |
| `images/pic.png` (상대경로) | basePath 기준 해석 → `md-image:///absolute/path/images/pic.png` |
| `/Users/.../pic.png` (절대경로) | `md-image:///Users/.../pic.png` |

**파라미터:** `basePath: string` (현재 열린 마크다운 파일의 경로)
- basePath가 없으면 플러그인 스킵 (로컬 경로 변환 불가)

### 3. CSP Update

`src/renderer/index.html`의 Content-Security-Policy에 img-src 디렉티브 추가:

```
img-src 'self' md-image: https: http: data:
```

### 4. Data Flow

```
App (filePath 보유)
  → MarkdownView (props로 filePath 전달)
    → useMarkdown(content, basePath)
      → processMarkdown(content, basePath)
        → createProcessor(basePath)
          → rehypeImageResolve({ basePath })
```

### 5. Image Component

기존 Image 컴포넌트는 변경 없음. rehype 플러그인이 src를 이미 변환한 상태로 전달하므로 그대로 사용한다.

## Components to Modify

| 파일 | 변경 내용 |
|------|----------|
| `src/main/main.ts` | `protocol.handle('md-image', ...)` 등록 |
| `src/renderer/pipeline/rehypeImageResolve.ts` | 새 파일 — rehype 플러그인 |
| `src/renderer/pipeline/createProcessor.ts` | basePath 파라미터 추가, 플러그인 연결 |
| `src/renderer/hooks/useMarkdown.ts` | basePath 파라미터 전달 |
| `src/renderer/components/MarkdownView.tsx` | basePath (filePath) 전달 |
| `src/renderer/index.html` | CSP `img-src` 추가 |

## Testing

- **Unit:** rehypeImageResolve 플러그인의 경로 변환 로직
- **E2E:** 이미지가 포함된 마크다운 파일 렌더링 확인
