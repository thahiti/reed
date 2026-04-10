# Chapter TOC Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 읽기 모드 전용 투명 TOC 오버레이를 구현한다. `O` 키로 토글, 본문 위에 떠 있는 미니멀 텍스트 목록, 활성 헤딩 자동 하이라이트, 클릭 시 해당 섹션으로 스크롤.

**Architecture:** unified 파이프라인에 `rehypeCollectHeadings` 커스텀 플러그인을 추가해 hast 트리에서 헤딩을 수집한다. `useMarkdown`이 `{ rendered, headings }`를 반환하도록 확장하고, 기존 `MarkdownView`의 훅 호출을 `App.tsx`로 끌어올린다. 오버레이는 `position: absolute`로 본문 위에 배치하며, `useActiveHeading` 훅이 IntersectionObserver로 현재 보이는 헤딩 id를 추적한다. 단축키/메뉴 토글은 기존 `view:toggle-edit` 패턴(`registerAccelerator: false` + 렌더러 keydown)을 그대로 따른다.

**Tech Stack:** TypeScript, React, unified/rehype, IntersectionObserver, Electron IPC, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-10-chapter-toc-sidebar-design.md`

---

## File Structure

### 신규 파일
- `src/renderer/pipeline/anchorId.ts` — `toAnchorId(text)` 순수 함수
- `src/renderer/pipeline/anchorId.test.ts` — 단위 테스트
- `src/renderer/pipeline/rehypeCollectHeadings.ts` — hast visitor plugin
- `src/renderer/pipeline/rehypeCollectHeadings.test.ts` — 단위 테스트
- `src/shared/types/toc.ts` — `TocHeading`, `TocConfig`, `TocSettings` 타입
- `src/renderer/hooks/useActiveHeading.ts` — IntersectionObserver 훅
- `src/renderer/hooks/useActiveHeading.test.ts` — 단위 테스트
- `src/renderer/components/TocOverlay.tsx` — 오버레이 컴포넌트
- `src/renderer/components/TocOverlay.test.tsx` — RTL 테스트
- `src/renderer/components/TocOverlay.css` — 오버레이 스타일
- `tests/e2e/toc.spec.ts` — Playwright E2E

### 수정 파일
- `src/renderer/components/markdown/Heading.tsx` — `toAnchorId` import, ReactNode text 추출
- `src/renderer/pipeline/createProcessor.ts` — 플러그인 추가, 반환 타입 확장
- `src/renderer/hooks/useMarkdown.ts` — 반환 타입 `{ rendered, headings }`
- `src/renderer/components/MarkdownView.tsx` — `rendered` prop으로 수신
- `src/renderer/hooks/useSettings.ts` — `toc` 기본값 병합 및 검증
- `src/shared/types.ts` — `AppSettings`에 `toc?: TocSettings` 추가
- `src/shared/keybindings.ts` — `view:toggle-toc` 액션 추가
- `src/main/menu.ts` — `View → Toggle Outline` 메뉴 아이템
- `src/renderer/App.tsx` — `tocVisible` 상태, 토글 핸들러, TocOverlay 렌더

---

## Task 1: Extract `toAnchorId` into its own module

**Files:**
- Create: `src/renderer/pipeline/anchorId.ts`
- Create: `src/renderer/pipeline/anchorId.test.ts`
- Modify: `src/renderer/components/markdown/Heading.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/pipeline/anchorId.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toAnchorId } from './anchorId';

describe('toAnchorId', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toAnchorId('Hello World')).toBe('hello-world');
  });

  it('strips non-word characters except hyphens', () => {
    expect(toAnchorId('What is it? (really)')).toBe('what-is-it-really');
  });

  it('collapses multiple whitespaces', () => {
    expect(toAnchorId('Many   spaces   here')).toBe('many-spaces-here');
  });

  it('returns empty string for empty input', () => {
    expect(toAnchorId('')).toBe('');
  });

  it('preserves underscores', () => {
    expect(toAnchorId('snake_case_text')).toBe('snake_case_text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/pipeline/anchorId.test.ts`
Expected: FAIL with "Cannot find module './anchorId'".

- [ ] **Step 3: Create `anchorId.ts` with minimal implementation**

Create `src/renderer/pipeline/anchorId.ts`:

```ts
export const toAnchorId = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
```

Note: the extra `-+` collapse and edge-trim handles inputs like `"What is it? (really)"` cleanly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/pipeline/anchorId.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Refactor `Heading.tsx` to use it**

Replace `src/renderer/components/markdown/Heading.tsx`:

```tsx
import type { FC, HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { toAnchorId } from '../../pipeline/anchorId';

type HeadingProps = PropsWithChildren<
  HTMLAttributes<HTMLHeadingElement> & {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  }
>;

const extractText = (node: ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
};

const tagMap = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<1 | 2 | 3 | 4 | 5 | 6, string>;

export const Heading: FC<HeadingProps> = ({ level, children, id: idFromProps, ...rest }) => {
  const Tag = tagMap[level];
  const id = idFromProps ?? toAnchorId(extractText(children));
  const levelStr = String(level);
  return (
    <Tag className={`heading heading-${levelStr}`} id={id} {...rest}>
      {children}
    </Tag>
  );
};
```

- [ ] **Step 6: Run all tests**

Run: `pnpm test`
Expected: all tests PASS. Existing Heading-related tests still work; new anchorId tests pass.

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/pipeline/anchorId.ts src/renderer/pipeline/anchorId.test.ts src/renderer/components/markdown/Heading.tsx
git commit -m "refactor(heading): extract toAnchorId and support nested children

Pure string-based toAnchorId moves to pipeline/anchorId.ts. Heading.tsx now
walks ReactNode children recursively so headings with inline code/emphasis
produce stable ids. Accepts id from props when provided."
```

---

## Task 2: Add `TocHeading` / `TocConfig` / `TocSettings` types

**Files:**
- Create: `src/shared/types/toc.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Create `toc.ts` types**

Create `src/shared/types/toc.ts`:

```ts
export type TocHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type TocHeading = {
  readonly level: TocHeadingLevel;
  readonly id: string;
  readonly text: string;
};

export type TocPosition = 'left' | 'right';

export type TocSettings = {
  readonly position: TocPosition;
  readonly minLevel: TocHeadingLevel;
  readonly maxLevel: TocHeadingLevel;
  readonly visible: boolean;
};

export const defaultTocSettings: TocSettings = {
  position: 'right',
  minLevel: 2,
  maxLevel: 4,
  visible: false,
};
```

- [ ] **Step 2: Add `toc` to `AppSettings`**

Modify `src/shared/types.ts` — add import and extend `AppSettings`:

Find the existing `AppSettings` declaration (around line 65) and update:

```ts
import type { TocSettings } from './types/toc';

// ...

export type AppSettings = {
  readonly scroll: ScrollSettings;
  readonly bodyFont?: string;
  readonly codeFont?: string;
  readonly lightTheme?: ThemeOverrides;
  readonly darkTheme?: ThemeOverrides;
  readonly keybindings?: Partial<Record<string, string>>;
  readonly toc?: Partial<TocSettings>;
};
```

The field is `Partial` because users may override only some sub-fields in `settings.json`.

- [ ] **Step 3: Typecheck**

Run: `pnpm lint`
Expected: 0 violations. If TypeScript complains, fix import paths.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/toc.ts src/shared/types.ts
git commit -m "feat(toc): add TocHeading and TocSettings types

Introduces shared types for the TOC overlay feature: TocHeading (level/id/text),
TocSettings (position/minLevel/maxLevel/visible), and defaults."
```

---

## Task 3: Implement `rehypeCollectHeadings` plugin

**Files:**
- Create: `src/renderer/pipeline/rehypeCollectHeadings.ts`
- Create: `src/renderer/pipeline/rehypeCollectHeadings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/pipeline/rehypeCollectHeadings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { rehypeCollectHeadings } from './rehypeCollectHeadings';
import type { TocHeading } from '../../shared/types/toc';

const run = (markdown: string): TocHeading[] => {
  const file = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeCollectHeadings)
    .processSync(markdown);
  return (file.data.headings ?? []) as TocHeading[];
};

describe('rehypeCollectHeadings', () => {
  it('collects all heading levels', () => {
    const headings = run('# One\n\n## Two\n\n### Three');
    expect(headings).toEqual([
      { level: 1, id: 'one', text: 'One' },
      { level: 2, id: 'two', text: 'Two' },
      { level: 3, id: 'three', text: 'Three' },
    ]);
  });

  it('returns empty array when no headings', () => {
    expect(run('just a paragraph')).toEqual([]);
  });

  it('flattens inline code and emphasis in heading text', () => {
    const headings = run('## Use `foo` **boldly**');
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({
      level: 2,
      text: 'Use foo boldly',
      id: 'use-foo-boldly',
    });
  });

  it('sets properties.id on the hast heading node', () => {
    const file = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeCollectHeadings)
      .runSync(
        unified().use(remarkParse).parse('## Section A'),
      );
    // Walk to verify id is set on the h2 node
    const tree = file as { children: Array<{ tagName?: string; properties?: { id?: string } }> };
    const h2 = tree.children.find((n) => n.tagName === 'h2');
    expect(h2?.properties?.id).toBe('section-a');
  });

  it('handles duplicate headings with suffixed ids', () => {
    const headings = run('## Intro\n\n## Intro');
    expect(headings.map((h) => h.id)).toEqual(['intro', 'intro-2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/pipeline/rehypeCollectHeadings.test.ts`
Expected: FAIL with "Cannot find module './rehypeCollectHeadings'".

- [ ] **Step 3: Implement the plugin**

Create `src/renderer/pipeline/rehypeCollectHeadings.ts`:

```ts
import type { Plugin } from 'unified';
import type { Root, Element, ElementContent } from 'hast';
import { toAnchorId } from './anchorId';
import type { TocHeading, TocHeadingLevel } from '../../shared/types/toc';

const HEADING_TAGS: Readonly<Record<string, TocHeadingLevel>> = {
  h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6,
};

const extractText = (nodes: ReadonlyArray<ElementContent>): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return node.value;
      if (node.type === 'element') return extractText(node.children);
      return '';
    })
    .join('');

const uniqueId = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}-${String(i)}`)) i += 1;
  const next = `${base}-${String(i)}`;
  used.add(next);
  return next;
};

export const rehypeCollectHeadings: Plugin<[], Root> = () => (tree, file) => {
  const headings: TocHeading[] = [];
  const usedIds = new Set<string>();

  const visit = (nodes: ReadonlyArray<ElementContent>): void => {
    for (const node of nodes) {
      if (node.type !== 'element') continue;
      const el = node as Element;
      const level = el.tagName ? HEADING_TAGS[el.tagName] : undefined;
      if (level !== undefined) {
        const text = extractText(el.children);
        const baseId = toAnchorId(text) || `heading-${String(headings.length + 1)}`;
        const id = uniqueId(baseId, usedIds);
        el.properties = { ...(el.properties ?? {}), id };
        headings.push({ level, id, text });
      } else if (el.children) {
        visit(el.children);
      }
    }
  };

  visit(tree.children);
  (file.data as { headings?: TocHeading[] }).headings = headings;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/pipeline/rehypeCollectHeadings.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pipeline/rehypeCollectHeadings.ts src/renderer/pipeline/rehypeCollectHeadings.test.ts
git commit -m "feat(toc): add rehypeCollectHeadings plugin

Walks hast tree for h1..h6 nodes, flattens inline text, assigns unique
anchor ids via toAnchorId, and stores the result in file.data.headings.
Also sets node.properties.id so the React pipeline picks up the same id."
```

---

## Task 4: Integrate plugin into processor and extend `processMarkdown` return type

**Files:**
- Modify: `src/renderer/pipeline/createProcessor.ts`

- [ ] **Step 1: Update `createProcessor.ts`**

At the top, add import:

```ts
import { rehypeCollectHeadings } from './rehypeCollectHeadings';
import type { TocHeading } from '../../shared/types/toc';
```

Inside `buildProcessor`, add the plugin right after `remarkRehype` setup and before `rehypeReact`. Locate the line `processor.use(remarkRehype, ...)` and add after it (before `rehypeFrontmatterTable`):

```ts
processor.use(rehypeCollectHeadings);
```

Update the `processMarkdown` function at the bottom of the file:

```ts
export type ProcessMarkdownResult = {
  readonly rendered: ReactElement;
  readonly headings: readonly TocHeading[];
};

export const processMarkdown = (markdown: string, basePath = ''): ProcessMarkdownResult => {
  const processor = buildProcessor(basePath);
  const file = processor.processSync(markdown);
  const headings = ((file.data as { headings?: TocHeading[] }).headings ?? []) as readonly TocHeading[];
  return { rendered: file.result as ReactElement, headings };
};
```

- [ ] **Step 2: Run existing tests to catch breakage**

Run: `pnpm test`
Expected: any test that calls `processMarkdown` directly will break (if they exist). They need to be updated to destructure `{ rendered }`. Fix them inline. If all tests pass, proceed.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pipeline/createProcessor.ts
git commit -m "feat(toc): wire rehypeCollectHeadings into processor

processMarkdown now returns { rendered, headings }. The heading list is
extracted from file.data after processSync."
```

---

## Task 5: Update `useMarkdown` return type and propagate to `MarkdownView`

**Files:**
- Modify: `src/renderer/hooks/useMarkdown.ts`
- Modify: `src/renderer/components/MarkdownView.tsx`
- Modify: `src/renderer/App.tsx`

**Why:** Headings must be reachable from `App.tsx` so the TOC overlay can render them. Lift the `useMarkdown` call out of `MarkdownView` into `App.tsx`, and pass `rendered` as a prop.

- [ ] **Step 1: Update `useMarkdown.ts`**

Replace the file contents:

```ts
import { useMemo } from 'react';
import { processMarkdown, type ProcessMarkdownResult } from '../pipeline/createProcessor';

export const useMarkdown = (content: string, basePath = ''): ProcessMarkdownResult =>
  useMemo(() => processMarkdown(content, basePath), [content, basePath]);
```

- [ ] **Step 2: Update `MarkdownView.tsx` — accept `rendered` as prop, remove hook call**

Edit `src/renderer/components/MarkdownView.tsx`:

Remove the import `import { useMarkdown } from '../hooks/useMarkdown';`.

Update the props type (drop `content` and `filePath`, add `rendered`):

```ts
import type { ReactElement } from 'react';

type MarkdownViewProps = {
  readonly rendered: ReactElement;
  readonly initialLine?: number;
  readonly scrollSettings: ScrollSettings;
  readonly onTopLineChange?: (line: number) => void;
};
```

Remove the first line of the function body (`const rendered = useMarkdown(content, filePath);`) and update the destructure:

```ts
export const MarkdownView: FC<MarkdownViewProps> = ({ rendered, initialLine, scrollSettings, onTopLineChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // ...rest unchanged
```

`filePath` was previously used only as the `basePath` arg for `useMarkdown`, which now happens in `App.tsx`, so it's fully removed from this component. Any reference to `content` inside MarkdownView should also be gone — the variable `rendered` is now a prop.

- [ ] **Step 3: Update `App.tsx` to call `useMarkdown` and pass `rendered`**

Near the top of `App` component (after `useTabs` destructuring around line 18), add:

```ts
import { useMarkdown } from './hooks/useMarkdown';

// ...inside App component, before the useCallback blocks:
const { rendered: renderedMarkdown, headings: markdownHeadings } = useMarkdown(
  activeTab?.content ?? '',
  activeTab?.filePath ?? undefined,
);
```

Then update the `MarkdownView` JSX around line 334 (drop `content` and `filePath` — they're no longer props):

```tsx
<MarkdownView
  rendered={renderedMarkdown}
  initialLine={topLineRef.current}
  scrollSettings={settings.scroll}
  onTopLineChange={(line) => { topLineRef.current = line; }}
/>
```

`markdownHeadings` is unused for now but will be consumed in Task 11. Add a `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment only if lint fails — otherwise leave it. Actually: prefix with underscore to silence lint: `const { rendered: renderedMarkdown, headings: _markdownHeadings } = ...`. Revert the underscore in Task 11.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: existing MarkdownView tests may reference `content` prop. Update them to pass `rendered` (pre-computed via `processMarkdown(content).rendered`). If there are no such tests, skip.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 6: Smoke-check the app**

Run: `pnpm dev` in another terminal, open a markdown file, verify it still renders correctly. Close dev.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/hooks/useMarkdown.ts src/renderer/components/MarkdownView.tsx src/renderer/App.tsx
git commit -m "refactor(markdown): lift useMarkdown call to App

useMarkdown now returns { rendered, headings }. MarkdownView becomes
presentational, receiving rendered as a prop. This prepares headings to
flow into the upcoming TOC overlay."
```

---

## Task 6: Add `view:toggle-toc` keybinding action

**Files:**
- Modify: `src/shared/keybindings.ts`

- [ ] **Step 1: Update `keybindings.ts`**

Replace the `keybindingActions` and `defaultKeybindings` declarations:

```ts
export const keybindingActions = [
  'file:new',
  'file:open',
  'file:quick-open',
  'file:save',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'view:toggle-toc',
  'help:show',
] as const;

export type KeybindingAction = (typeof keybindingActions)[number];

export const defaultKeybindings: Readonly<Record<KeybindingAction, string>> = {
  'file:new': 'CmdOrCtrl+N',
  'file:open': 'CmdOrCtrl+O',
  'file:quick-open': 'CmdOrCtrl+P',
  'file:save': 'CmdOrCtrl+S',
  'tab:close': 'CmdOrCtrl+W',
  'tab:prev': 'Ctrl+,',
  'tab:next': 'Ctrl+.',
  'view:toggle-edit': 'T',
  'view:toggle-toc': 'O',
  'help:show': 'CmdOrCtrl+/',
};
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 3: Commit**

```bash
git add src/shared/keybindings.ts
git commit -m "feat(toc): add view:toggle-toc keybinding action

Default accelerator is single-letter O, matching the view:toggle-edit
pattern. Custom override via settings.json.keybindings['view:toggle-toc']."
```

---

## Task 7: Validate TOC settings inside `useSettings`

**Files:**
- Modify: `src/renderer/hooks/useSettings.ts`
- Create: `src/renderer/hooks/useSettings.test.ts` (if not already present — check first with `ls src/renderer/hooks/useSettings*`)

- [ ] **Step 1: Write the failing test**

Create `src/renderer/hooks/useSettings.test.ts` (or append to existing):

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeTocSettings } from './useSettings';
import { defaultTocSettings } from '../../shared/types/toc';

describe('sanitizeTocSettings', () => {
  it('returns defaults when input is undefined', () => {
    expect(sanitizeTocSettings(undefined)).toEqual(defaultTocSettings);
  });

  it('falls back to right when position is invalid', () => {
    const result = sanitizeTocSettings({ position: 'middle' as never });
    expect(result.position).toBe('right');
  });

  it('preserves valid left position', () => {
    expect(sanitizeTocSettings({ position: 'left' }).position).toBe('left');
  });

  it('swaps minLevel and maxLevel when reversed', () => {
    const result = sanitizeTocSettings({ minLevel: 5, maxLevel: 2 });
    expect(result.minLevel).toBe(2);
    expect(result.maxLevel).toBe(5);
  });

  it('clamps out-of-range levels', () => {
    const result = sanitizeTocSettings({ minLevel: 0 as never, maxLevel: 9 as never });
    expect(result.minLevel).toBeGreaterThanOrEqual(1);
    expect(result.maxLevel).toBeLessThanOrEqual(6);
  });

  it('coerces non-boolean visible to false', () => {
    const result = sanitizeTocSettings({ visible: 'yes' as never });
    expect(result.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/hooks/useSettings.test.ts`
Expected: FAIL with "sanitizeTocSettings is not exported".

- [ ] **Step 3: Update `useSettings.ts`**

Replace the file:

```ts
import { useState, useEffect } from 'react';
import type { AppSettings } from '../../shared/types';
import { defaultTocSettings, type TocSettings, type TocHeadingLevel, type TocPosition } from '../../shared/types/toc';

const defaultSettings: AppSettings = {
  scroll: {
    stepLines: 8,
    pageLines: 30,
  },
  toc: defaultTocSettings,
};

const clampLevel = (value: unknown, fallback: TocHeadingLevel): TocHeadingLevel => {
  if (typeof value !== 'number') return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 6) return 6;
  return rounded as TocHeadingLevel;
};

const isPosition = (value: unknown): value is TocPosition =>
  value === 'left' || value === 'right';

export const sanitizeTocSettings = (input: Partial<TocSettings> | undefined): TocSettings => {
  const base = { ...defaultTocSettings, ...(input ?? {}) };
  const position: TocPosition = isPosition(input?.position) ? input.position : 'right';
  let minLevel = clampLevel(base.minLevel, defaultTocSettings.minLevel);
  let maxLevel = clampLevel(base.maxLevel, defaultTocSettings.maxLevel);
  if (minLevel > maxLevel) {
    [minLevel, maxLevel] = [maxLevel, minLevel];
  }
  const visible = typeof base.visible === 'boolean' ? base.visible : false;
  return { position, minLevel, maxLevel, visible };
};

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    void window.api.invoke('settings:get').then((stored) => {
      setSettings({
        ...stored,
        toc: sanitizeTocSettings(stored.toc),
      });
    });
  }, []);

  return settings;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/hooks/useSettings.test.ts`
Expected: PASS, 6 tests green.

- [ ] **Step 5: Run lint and full test suite**

Run: `pnpm lint && pnpm test`
Expected: 0 lint, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useSettings.ts src/renderer/hooks/useSettings.test.ts
git commit -m "feat(toc): sanitize and merge TocSettings in useSettings

Invalid position falls back to 'right', reversed level range is swapped,
levels are clamped to [1, 6], and non-boolean visible becomes false."
```

---

## Task 8: Implement `useActiveHeading` hook

**Files:**
- Create: `src/renderer/hooks/useActiveHeading.ts`
- Create: `src/renderer/hooks/useActiveHeading.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/hooks/useActiveHeading.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveHeading } from './useActiveHeading';

type ObserverCallback = (entries: ReadonlyArray<{ target: Element; isIntersecting: boolean }>) => void;

class MockIntersectionObserver {
  callback: ObserverCallback;
  observed: Element[] = [];
  constructor(cb: ObserverCallback) { this.callback = cb; }
  observe(el: Element) { this.observed.push(el); }
  unobserve(el: Element) { this.observed = this.observed.filter((o) => o !== el); }
  disconnect() { this.observed = []; }
  fire(entries: ReadonlyArray<{ id: string; isIntersecting: boolean }>) {
    this.callback(
      entries.map((e) => ({
        target: document.getElementById(e.id) as Element,
        isIntersecting: e.isIntersecting,
      })),
    );
  }
}

let instances: MockIntersectionObserver[] = [];

beforeEach(() => {
  instances = [];
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: ObserverCallback) => {
      const obs = new MockIntersectionObserver(cb);
      instances.push(obs);
      return obs;
    }),
  );
  document.body.innerHTML = `
    <h2 id="alpha">Alpha</h2>
    <h2 id="beta">Beta</h2>
    <h2 id="gamma">Gamma</h2>
  `;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useActiveHeading', () => {
  it('returns null initially', () => {
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBeNull();
  });

  it('returns the topmost intersecting id', () => {
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    act(() => {
      instances[0].fire([
        { id: 'beta', isIntersecting: true },
        { id: 'gamma', isIntersecting: true },
      ]);
    });
    expect(result.current).toBe('beta');
  });

  it('recreates the observer when headingIds change', () => {
    const { rerender } = renderHook(({ ids }) => useActiveHeading(ids), {
      initialProps: { ids: ['alpha', 'beta'] },
    });
    expect(instances).toHaveLength(1);
    rerender({ ids: ['beta', 'gamma'] });
    expect(instances).toHaveLength(2);
  });

  it('returns null when no ids provided', () => {
    const { result } = renderHook(() => useActiveHeading([]));
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/hooks/useActiveHeading.test.ts`
Expected: FAIL with "Cannot find module './useActiveHeading'".

- [ ] **Step 3: Implement the hook**

Create `src/renderer/hooks/useActiveHeading.ts`:

```ts
import { useEffect, useState } from 'react';

export const useActiveHeading = (headingIds: readonly string[]): string | null => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    const idSet = new Set(headingIds);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting && e.target.id && idSet.has(e.target.id));
        if (visible.length === 0) return;
        const topmost = visible.reduce((best, entry) => {
          const bestRect = best.target.getBoundingClientRect();
          const entryRect = entry.target.getBoundingClientRect();
          return entryRect.top < bestRect.top ? entry : best;
        });
        setActiveId(topmost.target.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    headingIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => { observer.disconnect(); };
  }, [headingIds]);

  return activeId;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/hooks/useActiveHeading.test.ts`
Expected: PASS, 4 tests green.

If the "topmost" test fails because `getBoundingClientRect` returns zeroes in jsdom, simplify the tiebreak in the implementation by using the order of `headingIds` array: the first id in the array that is currently intersecting wins. Update the hook:

```ts
const firstVisibleId = headingIds.find((id) =>
  entries.some((e) => e.isIntersecting && e.target.id === id),
);
if (firstVisibleId !== undefined) setActiveId(firstVisibleId);
```

Re-run the test — this version is also deterministic without DOM measurements.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useActiveHeading.ts src/renderer/hooks/useActiveHeading.test.ts
git commit -m "feat(toc): add useActiveHeading hook

IntersectionObserver-based hook returning the id of the topmost visible
heading. Observer rebuilds when headingIds change."
```

---

## Task 9: Create `TocOverlay` component

**Files:**
- Create: `src/renderer/components/TocOverlay.tsx`
- Create: `src/renderer/components/TocOverlay.css`
- Create: `src/renderer/components/TocOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/TocOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TocOverlay } from './TocOverlay';
import type { TocHeading } from '../../shared/types/toc';

const headings: readonly TocHeading[] = [
  { level: 2, id: 'intro', text: 'Intro' },
  { level: 3, id: 'setup', text: 'Setup' },
  { level: 2, id: 'usage', text: 'Usage' },
];

describe('TocOverlay', () => {
  it('renders nothing when headings array is empty', () => {
    const { container } = render(
      <TocOverlay headings={[]} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all headings as buttons', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Intro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usage' })).toBeInTheDocument();
  });

  it('marks active heading with aria-current', () => {
    render(
      <TocOverlay headings={headings} activeId="setup" position="right" onItemClick={() => {}} />,
    );
    const setup = screen.getByRole('button', { name: 'Setup' });
    expect(setup).toHaveAttribute('aria-current', 'location');
    const intro = screen.getByRole('button', { name: 'Intro' });
    expect(intro).not.toHaveAttribute('aria-current');
  });

  it('sets data-level on each button', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Intro' })).toHaveAttribute('data-level', '2');
    expect(screen.getByRole('button', { name: 'Setup' })).toHaveAttribute('data-level', '3');
  });

  it('calls onItemClick with id when button is clicked', () => {
    const onItemClick = vi.fn();
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={onItemClick} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
    expect(onItemClick).toHaveBeenCalledWith('usage');
  });

  it('applies position class to root aside', () => {
    const { container } = render(
      <TocOverlay headings={headings} activeId={null} position="left" onItemClick={() => {}} />,
    );
    expect(container.querySelector('aside.toc-overlay-left')).not.toBeNull();
  });

  it('provides aria-label on root', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByLabelText('Document outline')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/renderer/components/TocOverlay.test.tsx`
Expected: FAIL with "Cannot find module './TocOverlay'".

- [ ] **Step 3: Implement the component**

Create `src/renderer/components/TocOverlay.tsx`:

```tsx
import type { FC } from 'react';
import type { TocHeading, TocPosition } from '../../shared/types/toc';
import './TocOverlay.css';

type Props = {
  readonly headings: readonly TocHeading[];
  readonly activeId: string | null;
  readonly position: TocPosition;
  readonly onItemClick: (id: string) => void;
};

export const TocOverlay: FC<Props> = ({ headings, activeId, position, onItemClick }) => {
  if (headings.length === 0) return null;
  return (
    <aside
      className={`toc-overlay toc-overlay-${position}`}
      aria-label="Document outline"
    >
      {headings.map((h) => (
        <button
          key={h.id}
          type="button"
          data-level={String(h.level)}
          aria-current={activeId === h.id ? 'location' : undefined}
          onClick={() => { onItemClick(h.id); }}
        >
          {h.text}
        </button>
      ))}
    </aside>
  );
};
```

- [ ] **Step 4: Create the stylesheet**

Create `src/renderer/components/TocOverlay.css`:

```css
.toc-overlay {
  position: absolute;
  top: 52px;
  width: 220px;
  max-height: calc(100% - 84px);
  overflow-y: auto;
  font-size: 12px;
  z-index: 5;
  pointer-events: auto;
  scrollbar-width: none;
  background: transparent;
  border: none;
  padding: 0;
}

.toc-overlay::-webkit-scrollbar { display: none; }

.toc-overlay-right { right: 20px; }
.toc-overlay-left  { left: 20px; }

.toc-overlay button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 0;
  background: transparent;
  border: none;
  color: var(--toc-overlay-text, rgba(255, 255, 255, 0.35));
  cursor: pointer;
  line-height: 1.5;
  text-shadow: var(--toc-overlay-shadow, 0 0 1px rgba(0, 0, 0, 0.6));
  font: inherit;
}

.toc-overlay button:hover {
  color: var(--toc-overlay-text-hover, rgba(255, 255, 255, 0.9));
}

.toc-overlay button[aria-current="location"] {
  color: var(--toc-overlay-active, #4a9eff);
  font-weight: 600;
}

.toc-overlay button[data-level="1"] { padding-left: 0; }
.toc-overlay button[data-level="2"] { padding-left: 0; }
.toc-overlay button[data-level="3"] { padding-left: 14px; font-size: 11px; }
.toc-overlay button[data-level="4"] { padding-left: 28px; font-size: 11px; }
.toc-overlay button[data-level="5"] { padding-left: 42px; font-size: 10px; }
.toc-overlay button[data-level="6"] { padding-left: 56px; font-size: 10px; }

/* Light theme fallback */
:root[data-theme="light"] .toc-overlay button {
  color: var(--toc-overlay-text, rgba(0, 0, 0, 0.45));
  text-shadow: var(--toc-overlay-shadow, 0 0 1px rgba(255, 255, 255, 0.8));
}
:root[data-theme="light"] .toc-overlay button:hover {
  color: var(--toc-overlay-text-hover, rgba(0, 0, 0, 0.9));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/renderer/components/TocOverlay.test.tsx`
Expected: PASS, 7 tests green.

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/TocOverlay.tsx src/renderer/components/TocOverlay.css src/renderer/components/TocOverlay.test.tsx
git commit -m "feat(toc): add TocOverlay component

Transparent overlay with text-only listing. Renders nothing when headings
array is empty. Marks active entry with aria-current, exposes aria-label
'Document outline', and calls onItemClick on button press."
```

---

## Task 10: Add `View → Toggle Outline` menu item in main process

**Files:**
- Modify: `src/main/menu.ts`

- [ ] **Step 1: Locate the View submenu**

Open `src/main/menu.ts`, find the `label: 'View'` submenu and the existing `Toggle Edit Mode` item (around line 186-191). The pattern to mimic:

```ts
{
  label: 'Toggle Edit Mode',
  accelerator: kb['view:toggle-edit'],
  click: () => { mainWindow.webContents.send('menu:toggle-edit'); },
  registerAccelerator: false,
},
```

- [ ] **Step 2: Add the `Toggle Outline` item**

Immediately after the `Toggle Edit Mode` item (before the next `{ type: 'separator' }`), insert:

```ts
{
  label: 'Toggle Outline',
  accelerator: kb['view:toggle-toc'],
  click: () => { mainWindow.webContents.send('menu:toggle-toc'); },
  registerAccelerator: false,
},
```

Also update the `helpContent` keybinding JSON example (around line 89-100) to include the new action for documentation consistency:

```json
      "view:toggle-edit": "T",
      "view:toggle-toc": "O",
      "help:show": "CmdOrCtrl+/"
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: 0 violations.

- [ ] **Step 4: Commit**

```bash
git add src/main/menu.ts
git commit -m "feat(toc): add View → Toggle Outline menu item

Registered with registerAccelerator:false so the single-letter O accelerator
is a display hint only — actual key handling lives in the renderer (same
pattern as Toggle Edit Mode)."
```

---

## Task 11: Wire `App.tsx` — state, toggle handler, render

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Import the new pieces**

At the top of `src/renderer/App.tsx`, add imports:

```ts
import { TocOverlay } from './components/TocOverlay';
import { useActiveHeading } from './hooks/useActiveHeading';
import type { TocSettings } from '../shared/types/toc';
import { defaultTocSettings } from '../shared/types/toc';
```

- [ ] **Step 2: Add `tocVisible` state and remove the `_markdownHeadings` underscore**

In the `App` component body, just after `const [isEditMode, setIsEditMode] = useState(false);`, add:

```ts
const [tocVisible, setTocVisible] = useState(false);
```

Update the `useMarkdown` destructuring line (from Task 5) to use the real name:

```ts
const { rendered: renderedMarkdown, headings: markdownHeadings } = useMarkdown(
  activeTab?.content ?? '',
  activeTab?.filePath ?? undefined,
);
```

Compute the TOC configuration and filtered headings:

```ts
const tocConfig: TocSettings = { ...defaultTocSettings, ...(settings.toc ?? {}) };
const filteredHeadings = markdownHeadings.filter(
  (h) => h.level >= tocConfig.minLevel && h.level <= tocConfig.maxLevel,
);
const activeHeadingId = useActiveHeading(filteredHeadings.map((h) => h.id));
```

Note: when initial settings load completes, `settings.toc.visible` may be `true`. Initialize `tocVisible` from that value the first time settings arrive. Simplest approach — add a dedicated effect:

```ts
const tocInitializedRef = useRef(false);
useEffect(() => {
  if (tocInitializedRef.current) return;
  if (settings.toc !== undefined) {
    tocInitializedRef.current = true;
    setTocVisible(Boolean(settings.toc.visible));
  }
}, [settings.toc]);
```

Add `useRef` to the existing import if not already present.

- [ ] **Step 3: Add keydown binding in the existing keyboard-shortcuts effect**

Find the `handleKeyDown` function (around line 101). After the `view:toggle-edit` block (around line 132), insert:

```ts
// Toggle TOC (read mode only, no input focused)
if (matchAccelerator(e, kb['view:toggle-toc'], isMac)) {
  const target = e.target as HTMLElement;
  const isInputFocused = target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.classList.contains('cm-content');
  if (!isInputFocused && !isEditMode) {
    e.preventDefault();
    setTocVisible((prev) => !prev);
  }
}
```

- [ ] **Step 4: Add IPC listener for `menu:toggle-toc`**

Near the other menu IPC listeners (around line 245-265), add a new effect:

```ts
// Menu — toggle TOC
useEffect(() => {
  const unsub = window.api.on('menu:toggle-toc', () => {
    if (!isEditMode) setTocVisible((prev) => !prev);
  });
  return unsub;
}, [isEditMode]);
```

- [ ] **Step 5: Add click handler for TOC items**

Before the `return` statement, add:

```ts
const handleTocItemClick = useCallback((id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, []);
```

- [ ] **Step 6: Render the overlay conditionally**

Inside the `<main className="app-content">` section, after the `activeTab ? ... : <Welcome />` expression, add a sibling overlay render. The overlay must be inside `<main>` so its `position: absolute` is relative to the scroll container. Update the main block like this:

```tsx
<main className="app-content">
  {activeTab ? (
    isEditMode ? (
      <MarkdownEditor /* ...unchanged */ />
    ) : (
      <MarkdownView
        rendered={renderedMarkdown}
        initialLine={topLineRef.current}
        scrollSettings={settings.scroll}
        onTopLineChange={(line) => { topLineRef.current = line; }}
      />
    )
  ) : (
    <Welcome />
  )}
  {activeTab && !isEditMode && tocVisible && (
    <TocOverlay
      headings={filteredHeadings}
      activeId={activeHeadingId}
      position={tocConfig.position}
      onItemClick={handleTocItemClick}
    />
  )}
</main>
```

Confirm that `.app-content` has `position: relative` — check `src/renderer/App.css` or equivalent. If it isn't, add `position: relative;` to the `.app-content` rule so the overlay absolutes correctly.

- [ ] **Step 7: Run lint and full test suite**

Run: `pnpm lint && pnpm test`
Expected: 0 lint violations, all tests pass.

- [ ] **Step 8: Manual smoke test**

Run: `pnpm dev`
1. Open a markdown file with several headings
2. Press `O` — overlay appears on the right
3. Scroll — active heading changes color
4. Click a heading — body scrolls to it
5. Press `O` again — overlay disappears
6. Press `T` — enter edit mode; `O` in the editor inserts "o" (does not toggle)
7. Back to read mode — overlay state as before (still hidden if hidden, still visible if visible)

Close dev.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/App.tsx src/renderer/App.css
git commit -m "feat(toc): wire TocOverlay into App

Adds tocVisible state, O-key guard (read mode + no input focused),
menu:toggle-toc IPC listener, TocOverlay render, and smooth scrollIntoView
on item click. Filters headings by minLevel/maxLevel from settings."
```

---

## Task 12: Playwright E2E test

**Files:**
- Create: `tests/e2e/toc.spec.ts`

- [ ] **Step 1: Write the E2E spec**

The project launches Electron with `resolve(__dirname, '../../out/main/main.js')` and loads a file by sending `app:open-file` through the main-process `BrowserWindow.getAllWindows()[0].webContents`. Mirror that pattern.

Create `tests/e2e/toc.spec.ts`:

```ts
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const appPath = resolve(__dirname, '../../out/main/main.js');

const sample = [
  '# Top',
  '',
  '## Alpha',
  '',
  'Text about alpha.',
  '',
  '## Beta',
  '',
  'Text about beta.',
  '',
  '### Beta sub',
  '',
  'More text.',
  '',
  '## Gamma',
  '',
  'Final section.',
  '',
].join('\n');

test.describe('TOC overlay', () => {
  test('O key toggles the overlay in read mode and item click scrolls body', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-toc.md');
    writeFileSync(testFile, sample);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.markdown-content')).toBeVisible();

      // Starts hidden
      expect(await page.locator('aside.toc-overlay').count()).toBe(0);

      // Toggle on
      await page.keyboard.press('KeyO');
      await expect(page.locator('aside.toc-overlay')).toBeVisible();

      // Click a heading item → body scrolls to Beta
      await page.locator('aside.toc-overlay button', { hasText: 'Beta' }).first().click();
      await expect(page.locator('h2#beta')).toBeInViewport();

      // Toggle off
      await page.keyboard.press('KeyO');
      await expect(page.locator('aside.toc-overlay')).toHaveCount(0);

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });

  test('O key does not toggle the overlay in edit mode', async () => {
    const testFile = resolve(__dirname, '../../test-fixture-toc-edit.md');
    writeFileSync(testFile, sample);

    try {
      const app = await electron.launch({ args: [appPath] });
      const page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      await app.evaluate(({ BrowserWindow }, filePath) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('app:open-file', filePath);
      }, testFile);

      await expect(page.locator('.tab-item')).toBeVisible({ timeout: 5000 });

      // Enter edit mode (T)
      await page.keyboard.press('KeyT');
      await expect(page.locator('.cm-content')).toBeVisible();

      // Press O — expected to be consumed by CodeMirror, NOT toggle overlay
      await page.keyboard.press('KeyO');
      expect(await page.locator('aside.toc-overlay').count()).toBe(0);

      await app.close();
    } finally {
      unlinkSync(testFile);
    }
  });
});
```

- [ ] **Step 2: Build the app first**

Run: `pnpm build`
Expected: successful build producing `out/main/main.js`.

- [ ] **Step 3: Run the E2E test**

Run: `pnpm test:e2e tests/e2e/toc.spec.ts`
Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/toc.spec.ts
git commit -m "test(e2e): verify TOC overlay toggle and edit-mode guard

Covers O-key toggle in read mode, item click navigation, and the edit-mode
pass-through (typing O inserts a character without toggling)."
```

---

## Task 13: Build verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full lint + test**

Run: `pnpm lint && pnpm test`
Expected: 0 lint, all unit tests PASS.

- [ ] **Step 2: Full E2E**

Run: `pnpm build && pnpm test:e2e`
Expected: all E2E tests PASS, including existing ones.

- [ ] **Step 3: Production app build**

Run: `pnpm run build:app`
Expected: app bundle produced without errors.

- [ ] **Step 4: Smoke test the built app**

Launch the produced app manually. Repeat the Task 11 Step 8 scenario (open file → `O` → scroll → click item → `O` → edit mode → `O` passes through).

- [ ] **Step 5: Final commit if any fixups were needed**

If prior tasks required tweaks discovered here, commit them now with a `fix(toc):` prefix. Otherwise skip.

---

## Post-implementation check

- Spec file `docs/superpowers/specs/2026-04-10-chapter-toc-sidebar-design.md` sections to re-verify:
  - 목적 ✓ (Tasks 3, 9, 11)
  - 사용자 시나리오 ✓ (Tasks 11, 12)
  - 아키텍처 & 데이터 흐름 ✓ (Tasks 3–5, 11)
  - ID 일관성 ✓ (Tasks 1, 3)
  - 설정 스키마 & 검증 ✓ (Tasks 2, 7)
  - 메뉴/단축키/IPC ✓ (Tasks 6, 10, 11)
  - TocOverlay 컴포넌트 상세 ✓ (Task 9)
  - useActiveHeading ✓ (Task 8)
  - 테스트 전략 ✓ (Tasks 1, 3, 7, 8, 9, 12)
