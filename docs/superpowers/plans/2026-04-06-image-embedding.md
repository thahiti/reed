# Image Embedding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마크다운에 포함된 이미지 참조(`![alt](path)`)를 로컬 상대/절대경로 및 외부 URL 모두 렌더링할 수 있도록 지원한다.

**Architecture:** Main process에서 `md-image://` 커스텀 프로토콜을 등록하여 로컬 이미지 파일을 안전하게 서빙한다. Rehype 플러그인(`rehypeImageResolve`)이 파이프라인에서 이미지 src를 변환하고, CSP를 업데이트하여 외부 이미지도 허용한다.

**Tech Stack:** Electron `protocol.handle`, unified/rehype AST, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/main/protocol.ts` | `md-image://` 커스텀 프로토콜 등록 |
| Create | `src/renderer/pipeline/rehypeImageResolve.ts` | 이미지 src 경로 변환 rehype 플러그인 |
| Create | `tests/main/protocol.test.ts` | 커스텀 프로토콜 유닛 테스트 |
| Create | `tests/renderer/pipeline/rehypeImageResolve.test.ts` | rehype 플러그인 유닛 테스트 |
| Modify | `src/main/main.ts:30` | 프로토콜 등록 호출 |
| Modify | `src/renderer/pipeline/createProcessor.ts:46,103` | basePath 파라미터 추가, 플러그인 연결 |
| Modify | `src/renderer/hooks/useMarkdown.ts:5-6` | basePath 파라미터 전달 |
| Modify | `src/renderer/components/MarkdownView.tsx:7-12,50-51` | filePath prop 추가, useMarkdown에 전달 |
| Modify | `src/renderer/App.tsx:173` | MarkdownView에 filePath 전달 |
| Modify | `src/renderer/index.html:7-8` | CSP `img-src` 디렉티브 추가 |
| Modify | `tests/renderer/pipeline/createProcessor.test.ts` | basePath 전달하도록 기존 테스트 수정 |

---

### Task 1: Custom Protocol — `md-image://` 등록

**Files:**
- Create: `src/main/protocol.ts`
- Create: `tests/main/protocol.test.ts`
- Modify: `src/main/main.ts:30`

- [ ] **Step 1: Write failing test for MIME type mapping**

```typescript
// tests/main/protocol.test.ts
import { describe, it, expect } from 'vitest';
import { getMimeType, ALLOWED_EXTENSIONS } from '../../src/main/protocol';

describe('protocol', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('should include common image extensions', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.png');
      expect(ALLOWED_EXTENSIONS).toContain('.jpg');
      expect(ALLOWED_EXTENSIONS).toContain('.jpeg');
      expect(ALLOWED_EXTENSIONS).toContain('.gif');
      expect(ALLOWED_EXTENSIONS).toContain('.svg');
      expect(ALLOWED_EXTENSIONS).toContain('.webp');
      expect(ALLOWED_EXTENSIONS).toContain('.bmp');
      expect(ALLOWED_EXTENSIONS).toContain('.ico');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for png', () => {
      expect(getMimeType('.png')).toBe('image/png');
    });

    it('should return correct MIME type for svg', () => {
      expect(getMimeType('.svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME type for jpg', () => {
      expect(getMimeType('.jpg')).toBe('image/jpeg');
    });

    it('should return octet-stream for unknown extension', () => {
      expect(getMimeType('.xyz')).toBe('application/octet-stream');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project main tests/main/protocol.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement protocol module**

```typescript
// src/main/protocol.ts
import { protocol, net } from 'electron';
import { extname, normalize } from 'node:path';

export const ALLOWED_EXTENSIONS: ReadonlyArray<string> = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico',
];

const MIME_MAP: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

export const getMimeType = (ext: string): string =>
  MIME_MAP[ext] ?? 'application/octet-stream';

export const registerImageProtocol = (): void => {
  protocol.handle('md-image', (request) => {
    const url = new URL(request.url);
    const filePath = normalize(decodeURIComponent(url.pathname));
    const ext = extname(filePath).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(`file://${filePath}`);
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --project main tests/main/protocol.test.ts`
Expected: PASS

- [ ] **Step 5: Register protocol in main process**

Modify `src/main/main.ts` — add import and call inside `app.whenReady()`:

```typescript
// Add at line 3:
import { registerImageProtocol } from './protocol';

// Add at line 31 (inside app.whenReady, before createWindow):
  registerImageProtocol();
```

- [ ] **Step 6: Commit**

```bash
git add src/main/protocol.ts tests/main/protocol.test.ts src/main/main.ts
git commit -m "feat(image): register md-image custom protocol for local images"
```

---

### Task 2: Rehype Plugin — `rehypeImageResolve`

**Files:**
- Create: `src/renderer/pipeline/rehypeImageResolve.ts`
- Create: `tests/renderer/pipeline/rehypeImageResolve.test.ts`

- [ ] **Step 1: Write failing tests for image src transformation**

```typescript
// tests/renderer/pipeline/rehypeImageResolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveImageSrc } from '../../../src/renderer/pipeline/rehypeImageResolve';

describe('rehypeImageResolve', () => {
  describe('resolveImageSrc', () => {
    const basePath = '/Users/randy/docs/readme.md';

    it('should leave https URLs unchanged', () => {
      expect(resolveImageSrc('https://example.com/pic.png', basePath)).toBe('https://example.com/pic.png');
    });

    it('should leave http URLs unchanged', () => {
      expect(resolveImageSrc('http://example.com/pic.png', basePath)).toBe('http://example.com/pic.png');
    });

    it('should leave data URIs unchanged', () => {
      const dataUri = 'data:image/png;base64,iVBOR...';
      expect(resolveImageSrc(dataUri, basePath)).toBe(dataUri);
    });

    it('should convert relative path to md-image URL', () => {
      expect(resolveImageSrc('images/diagram.svg', basePath))
        .toBe('md-image:///Users/randy/docs/images/diagram.svg');
    });

    it('should convert dot-relative path to md-image URL', () => {
      expect(resolveImageSrc('./images/pic.png', basePath))
        .toBe('md-image:///Users/randy/docs/images/pic.png');
    });

    it('should convert absolute path to md-image URL', () => {
      expect(resolveImageSrc('/Users/other/pic.png', basePath))
        .toBe('md-image:///Users/other/pic.png');
    });

    it('should handle parent directory traversal', () => {
      const base = '/Users/randy/docs/sub/readme.md';
      expect(resolveImageSrc('../images/pic.png', base))
        .toBe('md-image:///Users/randy/docs/images/pic.png');
    });

    it('should return src unchanged when basePath is empty', () => {
      expect(resolveImageSrc('images/pic.png', '')).toBe('images/pic.png');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project renderer tests/renderer/pipeline/rehypeImageResolve.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rehypeImageResolve plugin**

```typescript
// src/renderer/pipeline/rehypeImageResolve.ts
import type { Root } from 'hast';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: ReadonlyArray<HastNode>;
};

const EXTERNAL_RE = /^(?:https?:|data:)/;

const dirname = (filePath: string): string => {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(0, lastSlash) : '';
};

const resolvePath = (baseDir: string, relativePath: string): string => {
  const parts = `${baseDir}/${relativePath}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return `/${resolved.join('/')}`;
};

export const resolveImageSrc = (src: string, basePath: string): string => {
  if (EXTERNAL_RE.test(src)) return src;
  if (!basePath) return src;

  const baseDir = dirname(basePath);
  const absolutePath = src.startsWith('/')
    ? src
    : resolvePath(baseDir, src);

  return `md-image://${absolutePath}`;
};

const visitImages = (node: HastNode, basePath: string): void => {
  if (node.type === 'element' && node.tagName === 'img' && node.properties) {
    const src = node.properties['src'];
    if (typeof src === 'string') {
      node.properties['src'] = resolveImageSrc(src, basePath);
    }
  }
  if (node.children) {
    node.children.forEach((child) => { visitImages(child, basePath); });
  }
};

export const rehypeImageResolve = (options: { readonly basePath: string }) =>
  (tree: Root) => {
    visitImages(tree as unknown as HastNode, options.basePath);
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --project renderer tests/renderer/pipeline/rehypeImageResolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pipeline/rehypeImageResolve.ts tests/renderer/pipeline/rehypeImageResolve.test.ts
git commit -m "feat(image): add rehypeImageResolve plugin for image src transformation"
```

---

### Task 3: Pipeline & Component Wiring

**Files:**
- Modify: `src/renderer/pipeline/createProcessor.ts:46,103`
- Modify: `src/renderer/hooks/useMarkdown.ts:5-6`
- Modify: `src/renderer/components/MarkdownView.tsx:7-12,50-51`
- Modify: `src/renderer/App.tsx:173`
- Modify: `tests/renderer/pipeline/createProcessor.test.ts`

- [ ] **Step 1: Write failing test for processMarkdown with basePath**

Add to `tests/renderer/pipeline/createProcessor.test.ts`:

```typescript
it('should resolve image src with basePath', () => {
  const md = '![alt](images/pic.png)';
  const result = processMarkdown(md, '/Users/randy/docs/readme.md');
  expect(result).toBeDefined();
  // The result is a React element tree; verify the image src was transformed
  const rendered = JSON.stringify(result);
  expect(rendered).toContain('md-image:///Users/randy/docs/images/pic.png');
});

it('should leave external image URLs unchanged', () => {
  const md = '![alt](https://example.com/pic.png)';
  const result = processMarkdown(md, '/Users/randy/docs/readme.md');
  const rendered = JSON.stringify(result);
  expect(rendered).toContain('https://example.com/pic.png');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --project renderer tests/renderer/pipeline/createProcessor.test.ts`
Expected: FAIL — processMarkdown does not accept second argument

- [ ] **Step 3: Wire basePath through pipeline**

Modify `src/renderer/pipeline/createProcessor.ts`:

Add import at line 23:
```typescript
import { rehypeImageResolve } from './rehypeImageResolve';
```

Change `buildProcessor` function signature at line 46:
```typescript
const buildProcessor = (basePath: string) => {
```

Add plugin after `rehypeSourceLines` (after line 53):
```typescript
  if (basePath) {
    processor.use(rehypeImageResolve, { basePath });
  }
```

Change `processMarkdown` at line 103:
```typescript
export const processMarkdown = (markdown: string, basePath = ''): ReactElement => {
  const processor = buildProcessor(basePath);
  const file = processor.processSync(markdown);
  return file.result as ReactElement;
};
```

- [ ] **Step 4: Wire basePath through useMarkdown**

Modify `src/renderer/hooks/useMarkdown.ts`:

```typescript
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { processMarkdown } from '../pipeline/createProcessor';

export const useMarkdown = (content: string, basePath = ''): ReactElement =>
  useMemo(() => processMarkdown(content, basePath), [content, basePath]);
```

- [ ] **Step 5: Wire filePath through MarkdownView**

Modify `src/renderer/components/MarkdownView.tsx`:

Add `filePath` to props type (line 8):
```typescript
type MarkdownViewProps = {
  readonly content: string;
  readonly filePath?: string;
  readonly initialLine?: number;
  readonly scrollSettings: ScrollSettings;
  readonly onTopLineChange?: (line: number) => void;
};
```

Update component destructuring (line 50):
```typescript
export const MarkdownView: FC<MarkdownViewProps> = ({ content, filePath, initialLine, scrollSettings, onTopLineChange }) => {
```

Update useMarkdown call (line 51):
```typescript
  const rendered = useMarkdown(content, filePath);
```

- [ ] **Step 6: Pass filePath from App**

Modify `src/renderer/App.tsx` line 173 — add `filePath` prop:

```tsx
            <MarkdownView
              content={activeTab.content}
              filePath={activeTab.filePath}
              initialLine={topLineRef.current}
              scrollSettings={settings.scroll}
              onTopLineChange={(line) => { topLineRef.current = line; }}
            />
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- --project renderer tests/renderer/pipeline/createProcessor.test.ts`
Expected: PASS (all existing + new tests)

- [ ] **Step 8: Commit**

```bash
git add src/renderer/pipeline/createProcessor.ts src/renderer/hooks/useMarkdown.ts src/renderer/components/MarkdownView.tsx src/renderer/App.tsx tests/renderer/pipeline/createProcessor.test.ts
git commit -m "feat(image): wire basePath through pipeline to resolve image paths"
```

---

### Task 4: CSP Update

**Files:**
- Modify: `src/renderer/index.html:6-9`

- [ ] **Step 1: Update CSP in index.html**

Change the Content-Security-Policy meta tag:

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' md-image: https: http: data:"
    />
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: 0 violations

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat(image): update CSP to allow local and external images"
```

---

### Task 5: E2E Test

**Files:**
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: Create test markdown with image**

Create a fixture file for the E2E test. Check the existing E2E test first to understand the pattern.

- [ ] **Step 2: Add E2E test for image rendering**

Add a test that:
1. Opens a markdown file containing `![alt](image-path)`
2. Verifies the `<img>` tag is present in the rendered output
3. Verifies the `src` attribute starts with `md-image://`

- [ ] **Step 3: Run E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/
git commit -m "test(image): add e2e test for image embedding"
```

---

### Task 6: Final Build Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: ALL PASS

- [ ] **Step 3: Build app**

Run: `pnpm run build:app`
Expected: SUCCESS
