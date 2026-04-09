# Frontmatter Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML frontmatter를 문서 상단에 key-value 테이블 카드로 렌더링

**Architecture:** `remark-frontmatter`로 YAML을 AST 노드로 인식. 커스텀 remark 플러그인 `remarkFrontmatterTable`에서 YAML 노드를 파싱하고 HTML 테이블로 변환. `FrontmatterTable` React 컴포넌트로 렌더링. CSS는 기존 테마 변수 활용.

**Tech Stack:** remark-frontmatter, yaml (npm), React, CSS

**Spec:** `docs/superpowers/specs/2026-04-09-frontmatter-table-design.md`

---

### Task 1: npm 패키지 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 패키지 설치**

```bash
pnpm add remark-frontmatter yaml
```

- [ ] **Step 2: 커밋**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add remark-frontmatter and yaml packages"
```

---

### Task 2: FrontmatterTable React 컴포넌트

**Files:**
- Create: `src/renderer/components/markdown/FrontmatterTable.tsx`
- Create: `tests/renderer/components/markdown/FrontmatterTable.test.tsx`

- [ ] **Step 1: 테스트 작성**

`tests/renderer/components/markdown/FrontmatterTable.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrontmatterTable } from '../../../../src/renderer/components/markdown/FrontmatterTable';

describe('FrontmatterTable', () => {
  it('should render key-value pairs as table rows', () => {
    const data = JSON.stringify({ title: 'Hello', author: 'Randy' });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('author')).toBeDefined();
    expect(screen.getByText('Randy')).toBeDefined();
  });

  it('should render array values as badge pills', () => {
    const data = JSON.stringify({ tags: ['electron', 'react'] });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('electron')).toBeDefined();
    expect(screen.getByText('react')).toBeDefined();
  });

  it('should render nothing for empty data', () => {
    const { container } = render(<FrontmatterTable data="{}" />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing for invalid JSON', () => {
    const { container } = render(<FrontmatterTable data="invalid" />);
    expect(container.innerHTML).toBe('');
  });

  it('should render boolean and number values', () => {
    const data = JSON.stringify({ draft: true, version: 3 });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('true')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('should render nested object as JSON string', () => {
    const data = JSON.stringify({ meta: { key: 'value' } });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('{"key":"value"}')).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/renderer/components/markdown/FrontmatterTable.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 컴포넌트 구현**

`src/renderer/components/markdown/FrontmatterTable.tsx`:

```typescript
import type { FC } from 'react';

type FrontmatterTableProps = {
  readonly data: string;
};

const renderValue = (value: unknown): JSX.Element | string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return (
      <span>
        {value.map((item, i) => (
          <span key={i} className="frontmatter-badge">
            {String(item)}
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const FrontmatterTable: FC<FrontmatterTableProps> = ({ data }) => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return null;

  return (
    <div className="frontmatter-table">
      <table>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="frontmatter-key">{key}</td>
              <td className="frontmatter-value">{renderValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/renderer/components/markdown/FrontmatterTable.test.tsx`
Expected: PASS

- [ ] **Step 5: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/renderer/components/markdown/FrontmatterTable.tsx tests/renderer/components/markdown/FrontmatterTable.test.tsx
git commit -m "feat(frontmatter): add FrontmatterTable React component"
```

---

### Task 3: remarkFrontmatterTable 플러그인

**Files:**
- Create: `src/renderer/pipeline/remarkFrontmatterTable.ts`
- Create: `tests/renderer/pipeline/remarkFrontmatterTable.test.ts`

이 플러그인은 mdast tree에서 `type: 'yaml'` 노드를 찾아 YAML을 파싱하고, `type: 'html'` 노드로 변환한다. 이 HTML 노드는 `<frontmatter-table data="...">` 형태이며, rehype-react에서 FrontmatterTable 컴포넌트로 매핑된다.

- [ ] **Step 1: 테스트 작성**

`tests/renderer/pipeline/remarkFrontmatterTable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../../src/renderer/pipeline/remarkFrontmatterTable';

describe('remarkFrontmatterTable', () => {
  it('should parse valid YAML into JSON string', () => {
    const yaml = 'title: Hello\nauthor: Randy';
    const result = parseFrontmatter(yaml);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.title).toBe('Hello');
    expect(parsed.author).toBe('Randy');
  });

  it('should parse YAML with array values', () => {
    const yaml = 'tags:\n  - electron\n  - react';
    const result = parseFrontmatter(yaml);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.tags).toEqual(['electron', 'react']);
  });

  it('should return null for empty YAML', () => {
    const result = parseFrontmatter('');
    expect(result).toBeNull();
  });

  it('should return null for invalid YAML', () => {
    const result = parseFrontmatter('{{invalid');
    expect(result).toBeNull();
  });

  it('should return null for non-object YAML', () => {
    const result = parseFrontmatter('just a string');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/renderer/pipeline/remarkFrontmatterTable.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 플러그인 구현**

`src/renderer/pipeline/remarkFrontmatterTable.ts`:

```typescript
import { parse } from 'yaml';

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

type MdastRoot = {
  type: 'root';
  children: MdastNode[];
};

export const parseFrontmatter = (yamlString: string): string | null => {
  if (!yamlString.trim()) return null;
  try {
    const parsed: unknown = parse(yamlString);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
};

export const remarkFrontmatterTable = () => (tree: MdastRoot) => {
  const yamlIndex = tree.children.findIndex((node) => node.type === 'yaml');
  if (yamlIndex === -1) return;

  const yamlNode = tree.children[yamlIndex];
  if (!yamlNode?.value) return;

  const data = parseFrontmatter(yamlNode.value);
  if (!data) {
    tree.children.splice(yamlIndex, 1);
    return;
  }

  tree.children[yamlIndex] = {
    type: 'html' as const,
    value: '',
    data: {
      hName: 'frontmatter-table',
      hProperties: { data },
    },
  } as unknown as MdastNode;
};
```

**참고**: `data.hName`과 `data.hProperties`는 `remark-rehype`가 mdast→hast 변환 시 사용하는 특수 프로퍼티이다. 이렇게 하면 hast에서 `<frontmatter-table data="...">` 엘리먼트가 생성되고, rehype-react에서 컴포넌트로 매핑된다.

실제로 `type: 'yaml'` 노드에 `data.hName`을 직접 설정하면 remark-rehype가 이를 커스텀 엘리먼트로 변환한다. 따라서 새 노드로 교체하는 대신 기존 노드를 수정해도 된다:

```typescript
export const remarkFrontmatterTable = () => (tree: MdastRoot) => {
  const yamlNode = tree.children.find((node) => node.type === 'yaml');
  if (!yamlNode?.value) return;

  const data = parseFrontmatter(yamlNode.value);
  if (!data) return;

  yamlNode.data = {
    hName: 'frontmatter-table',
    hProperties: { data },
  };
};
```

이 방식이 더 간단하다. 위 코드를 사용한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/renderer/pipeline/remarkFrontmatterTable.test.ts`
Expected: PASS

- [ ] **Step 5: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/renderer/pipeline/remarkFrontmatterTable.ts tests/renderer/pipeline/remarkFrontmatterTable.test.ts
git commit -m "feat(frontmatter): add remarkFrontmatterTable plugin for YAML parsing"
```

---

### Task 4: createProcessor에 플러그인 통합

**Files:**
- Modify: `src/renderer/pipeline/createProcessor.ts`
- Modify: `tests/renderer/pipeline/createProcessor.test.ts`

- [ ] **Step 1: 통합 테스트 작성**

`tests/renderer/pipeline/createProcessor.test.ts`에 추가:

```typescript
it('should render frontmatter as FrontmatterTable component', () => {
  const md = '---\ntitle: Hello\nauthor: Randy\n---\n\n# Content';
  const result = processMarkdown(md);
  const rendered = JSON.stringify(result);
  expect(rendered).toContain('frontmatter-table');
  expect(rendered).toContain('Hello');
  expect(rendered).toContain('Randy');
});

it('should render frontmatter array values', () => {
  const md = '---\ntags:\n  - electron\n  - react\n---\n\n# Content';
  const result = processMarkdown(md);
  const rendered = JSON.stringify(result);
  expect(rendered).toContain('frontmatter-badge');
  expect(rendered).toContain('electron');
  expect(rendered).toContain('react');
});

it('should handle markdown without frontmatter', () => {
  const md = '# Just a heading';
  const result = processMarkdown(md);
  const rendered = JSON.stringify(result);
  expect(rendered).not.toContain('frontmatter-table');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- tests/renderer/pipeline/createProcessor.test.ts`
Expected: FAIL — frontmatter rendered as raw text, not as component

- [ ] **Step 3: createProcessor.ts 수정**

`src/renderer/pipeline/createProcessor.ts`에 import 추가:

```typescript
import remarkFrontmatter from 'remark-frontmatter';
import { remarkFrontmatterTable } from './remarkFrontmatterTable';
import { FrontmatterTable } from '../components/markdown/FrontmatterTable';
```

`buildProcessor` 함수에서 `remarkParse` 직후에 추가:

```typescript
processor.use(remarkFrontmatter);
processor.use(remarkFrontmatterTable);
```

`rehypeReact` components에 매핑 추가:

```typescript
'frontmatter-table': (props: AnyProps) => {
  const data = typeof props.data === 'string' ? props.data : '{}';
  return jsx(FrontmatterTable, { data });
},
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- tests/renderer/pipeline/createProcessor.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 6: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add src/renderer/pipeline/createProcessor.ts tests/renderer/pipeline/createProcessor.test.ts
git commit -m "feat(frontmatter): integrate frontmatter table into markdown pipeline"
```

---

### Task 5: CSS 스타일링

**Files:**
- Modify: `src/renderer/styles/markdown.css`

- [ ] **Step 1: 프론트매터 테이블 CSS 추가**

`src/renderer/styles/markdown.css` 맨 끝에 추가:

```css
.frontmatter-table {
  margin-bottom: var(--spacing-heading-margin-top);
  border: 1px solid var(--color-table-border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 14px;
}

.frontmatter-table table {
  width: 100%;
  border-collapse: collapse;
}

.frontmatter-table tr:not(:last-child) {
  border-bottom: 1px solid var(--color-table-border);
}

.frontmatter-key {
  padding: 8px 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
  background-color: var(--color-code-bg);
  width: 120px;
  vertical-align: top;
  white-space: nowrap;
}

.frontmatter-value {
  padding: 8px 14px;
}

.frontmatter-badge {
  display: inline-block;
  background-color: var(--color-selection);
  color: var(--color-link);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 4px;
  margin-bottom: 2px;
}
```

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/renderer/styles/markdown.css
git commit -m "style(frontmatter): add table card CSS with theme variable support"
```

---

### Task 6: E2E 테스트

**Files:**
- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: E2E 테스트 작성**

```typescript
test('should render frontmatter as table card', async () => {
  const testFile = resolve(__dirname, '../../test-frontmatter.md');
  writeFileSync(testFile, '---\ntitle: Test Document\ntags:\n  - alpha\n  - beta\n---\n\n# Hello');

  try {
    const app = await electron.launch({ args: [appPath] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await app.evaluate(({ BrowserWindow }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('app:open-file', filePath);
    }, testFile);

    await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

    // Frontmatter table should be rendered
    await expect(page.locator('.frontmatter-table')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.frontmatter-key', { hasText: 'title' })).toBeVisible();
    await expect(page.locator('.frontmatter-value', { hasText: 'Test Document' })).toBeVisible();

    // Tags should be rendered as badges
    await expect(page.locator('.frontmatter-badge', { hasText: 'alpha' })).toBeVisible();
    await expect(page.locator('.frontmatter-badge', { hasText: 'beta' })).toBeVisible();

    // Regular content should also render
    await expect(page.locator('.markdown-content h1')).toHaveText('Hello');

    await app.close();
  } finally {
    try { unlinkSync(testFile); } catch { /* */ }
  }
});
```

- [ ] **Step 2: 빌드 후 E2E 실행**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add tests/e2e/app.spec.ts
git commit -m "test(e2e): add frontmatter table rendering test"
```

---

### Task 7: 최종 빌드 검증

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS

- [ ] **Step 4: 앱 빌드 및 설치**

Run: `pnpm run build:app && cp -R dist/mac-arm64/Reed.app /Applications/Reed.app`
Expected: 성공
