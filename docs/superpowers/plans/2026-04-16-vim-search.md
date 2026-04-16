# Vim-style Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the search feature with a Vim-style state machine: `/` to open, `Enter` to confirm, `n`/`N` to navigate, `Escape` to cancel — with a bottom-left search bar and persistent indicator.

**Architecture:** Replace the boolean `isOpen` model with a 3-phase state machine (`idle` → `inputting` → `confirmed`). SearchBar renders two modes (input vs indicator) at the bottom-left. Fix the existing bug where only the first match per text node is found.

**Tech Stack:** React hooks, DOM TreeWalker API, Vitest (jsdom), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-04-16-vim-search-design.md`

---

### Task 1: Fix highlightMatches to find all matches in a text node

This is an independent bug fix that must land first — the new state machine depends on correct match counts.

**Files:**
- Modify: `src/renderer/hooks/useSearch.ts` (lines 20-63, `highlightMatches` function)
- Create: `tests/renderer/hooks/useSearch.test.ts`

- [ ] **Step 1: Create test file with failing tests for multi-match bug**

Create `tests/renderer/hooks/useSearch.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// Test the pure highlightMatches function directly
// We need to export it from useSearch.ts for testing
import { highlightMatches, clearHighlights } from '../../src/renderer/hooks/useSearch';

const createContainer = (html: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('highlightMatches', () => {
  it('finds all occurrences in a single text node', () => {
    const container = createContainer('<p>the cat and the dog</p>');
    const marks = highlightMatches(container, 'the');
    expect(marks).toHaveLength(2);
  });

  it('finds overlapping-adjacent matches', () => {
    const container = createContainer('<p>aaa</p>');
    const marks = highlightMatches(container, 'a');
    expect(marks).toHaveLength(3);
  });

  it('is case insensitive', () => {
    const container = createContainer('<p>Hello hello HELLO</p>');
    const marks = highlightMatches(container, 'hello');
    expect(marks).toHaveLength(3);
  });

  it('returns empty array for empty query', () => {
    const container = createContainer('<p>some text</p>');
    const marks = highlightMatches(container, '');
    expect(marks).toHaveLength(0);
  });

  it('returns empty array for no matches', () => {
    const container = createContainer('<p>some text</p>');
    const marks = highlightMatches(container, 'xyz');
    expect(marks).toHaveLength(0);
  });

  it('finds matches across multiple elements', () => {
    const container = createContainer('<p>foo bar</p><p>foo baz</p>');
    const marks = highlightMatches(container, 'foo');
    expect(marks).toHaveLength(2);
  });

  it('wraps matches in mark.search-highlight elements', () => {
    const container = createContainer('<p>hello world</p>');
    const marks = highlightMatches(container, 'world');
    expect(marks).toHaveLength(1);
    expect(marks[0]!.tagName).toBe('MARK');
    expect(marks[0]!.classList.contains('search-highlight')).toBe(true);
    expect(marks[0]!.textContent).toBe('world');
  });
});

describe('clearHighlights', () => {
  it('removes all mark.search-highlight elements and restores text', () => {
    const container = createContainer('<p>hello world</p>');
    highlightMatches(container, 'hello');
    expect(container.querySelectorAll('mark.search-highlight')).toHaveLength(1);

    clearHighlights(container);
    expect(container.querySelectorAll('mark.search-highlight')).toHaveLength(0);
    expect(container.textContent).toBe('hello world');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --project renderer --reporter verbose tests/renderer/hooks/useSearch.test.ts`
Expected: FAIL — `highlightMatches` and `clearHighlights` are not exported.

- [ ] **Step 3: Export highlightMatches and clearHighlights from useSearch.ts**

In `src/renderer/hooks/useSearch.ts`, the functions `clearHighlights` (line 10) and `highlightMatches` (line 20) are already top-level `const` functions. Add `export` keyword to both:

```typescript
export const clearHighlights = (container: HTMLElement): void => {
```

```typescript
export const highlightMatches = (container: HTMLElement, query: string): ReadonlyArray<Element> => {
```

- [ ] **Step 4: Run tests to verify the multi-match test fails**

Run: `pnpm test -- --project renderer --reporter verbose tests/renderer/hooks/useSearch.test.ts`
Expected: `finds all occurrences in a single text node` FAILS (returns 1, expected 2). Other basic tests may pass.

- [ ] **Step 5: Fix highlightMatches to find all matches per text node**

Replace the `highlightMatches` function body in `src/renderer/hooks/useSearch.ts` (lines 20-63):

```typescript
export const highlightMatches = (container: HTMLElement, query: string): ReadonlyArray<Element> => {
  clearHighlights(container);
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const marks: Element[] = [];

  // Process nodes in reverse so DOM mutations don't shift indices of earlier nodes
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i]!;
    const text = textNode.textContent || '';
    const lowerText = text.toLowerCase();
    const parent = textNode.parentNode;
    if (!parent || parent.nodeName === 'MARK') continue;

    // Find all match positions in this text node
    const positions: number[] = [];
    let searchFrom = 0;
    while (searchFrom <= lowerText.length - lowerQuery.length) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;
      positions.push(idx);
      searchFrom = idx + lowerQuery.length;
    }

    if (positions.length === 0) continue;

    // Build fragment by splitting text at match boundaries, processing right-to-left
    const frag = document.createDocumentFragment();
    let lastEnd = 0;

    for (const pos of positions) {
      if (pos > lastEnd) {
        frag.appendChild(document.createTextNode(text.slice(lastEnd, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(pos, pos + query.length);
      frag.appendChild(mark);
      lastEnd = pos + query.length;
    }

    if (lastEnd < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    parent.replaceChild(frag, textNode);
  }

  // Collect marks in document order after all mutations
  container.querySelectorAll('mark.search-highlight').forEach((m) => marks.push(m));
  return marks;
};
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `pnpm test -- --project renderer --reporter verbose tests/renderer/hooks/useSearch.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/renderer/hooks/useSearch.ts tests/renderer/hooks/useSearch.test.ts
git commit -m "fix(search): find all matches within a single text node

Previously only the first match per text node was highlighted due to
a single indexOf call. Now uses a loop to find all occurrences.
Also exports highlightMatches/clearHighlights for unit testing."
```

---

### Task 2: Redesign useSearch hook with state machine

**Files:**
- Modify: `src/renderer/hooks/useSearch.ts`
- Modify: `tests/renderer/hooks/useSearch.test.ts`

- [ ] **Step 1: Add state machine tests to the test file**

Append to `tests/renderer/hooks/useSearch.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '../../src/renderer/hooks/useSearch';

describe('useSearch state machine', () => {
  const createContainerRef = () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>the cat and the dog and the bird</p>';
    // Mock scrollTop as a writable property
    Object.defineProperty(el, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 2000, writable: false });
    return { current: el };
  };

  it('starts in idle phase', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    expect(result.current.phase).toBe('idle');
  });

  it('transitions idle → inputting on openSearch', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    expect(result.current.phase).toBe('inputting');
  });

  it('transitions inputting → confirmed on confirmSearch', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    act(() => { result.current.confirmSearch(); });
    expect(result.current.phase).toBe('confirmed');
    expect(result.current.matchCount).toBe(3);
    expect(result.current.query).toBe('the');
  });

  it('transitions inputting → idle on confirmSearch with empty query', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.confirmSearch(); });
    expect(result.current.phase).toBe('idle');
  });

  it('transitions inputting → idle on closeSearch and restores scrollTop', () => {
    const ref = createContainerRef();
    ref.current.scrollTop = 500;
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    // Simulate user scrolling during search
    ref.current.scrollTop = 200;
    act(() => { result.current.closeSearch(); });
    expect(result.current.phase).toBe('idle');
    expect(ref.current.scrollTop).toBe(500);
  });

  it('transitions confirmed → idle on closeSearch without restoring scrollTop', () => {
    const ref = createContainerRef();
    ref.current.scrollTop = 500;
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    act(() => { result.current.confirmSearch(); });
    ref.current.scrollTop = 800;
    act(() => { result.current.closeSearch(); });
    expect(result.current.phase).toBe('idle');
    expect(ref.current.scrollTop).toBe(800);
  });

  it('transitions confirmed → inputting on openSearch', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    act(() => { result.current.confirmSearch(); });
    act(() => { result.current.openSearch(); });
    expect(result.current.phase).toBe('inputting');
  });

  it('nextMatch cycles through matches in confirmed phase', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    act(() => { result.current.confirmSearch(); });
    expect(result.current.currentIndex).toBe(0);
    act(() => { result.current.nextMatch(); });
    expect(result.current.currentIndex).toBe(1);
    act(() => { result.current.nextMatch(); });
    expect(result.current.currentIndex).toBe(2);
    act(() => { result.current.nextMatch(); });
    expect(result.current.currentIndex).toBe(0); // wraps
  });

  it('prevMatch cycles backwards in confirmed phase', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    act(() => { result.current.confirmSearch(); });
    expect(result.current.currentIndex).toBe(0);
    act(() => { result.current.prevMatch(); });
    expect(result.current.currentIndex).toBe(2); // wraps to last
  });

  it('closeSearch clears highlights', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useSearch(ref));
    act(() => { result.current.openSearch(); });
    act(() => { result.current.search('the'); });
    expect(ref.current.querySelectorAll('mark.search-highlight').length).toBeGreaterThan(0);
    act(() => { result.current.closeSearch(); });
    expect(ref.current.querySelectorAll('mark.search-highlight').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new state machine tests fail**

Run: `pnpm test -- --project renderer --reporter verbose tests/renderer/hooks/useSearch.test.ts`
Expected: FAIL — `phase`, `confirmSearch` not in return type.

- [ ] **Step 3: Rewrite useSearch hook with state machine**

Replace the hook portion of `src/renderer/hooks/useSearch.ts` (from line 65 to end). Keep the updated `highlightMatches`, `clearHighlights`, and `scrollToMatch` functions. Replace the `useSearch` hook:

```typescript
export type SearchPhase = 'idle' | 'inputting' | 'confirmed';

type SearchState = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matches: ReadonlyArray<Element>;
  readonly currentIndex: number;
  readonly savedScrollTop: number;
};

const initialState: SearchState = {
  phase: 'idle',
  query: '',
  matches: [],
  currentIndex: 0,
  savedScrollTop: 0,
};

export const useSearch = (containerRef: React.RefObject<HTMLElement | null>) => {
  const [state, setState] = useState<SearchState>(initialState);
  const matchesRef = useRef<ReadonlyArray<Element>>([]);
  const phaseRef = useRef<SearchPhase>('idle');

  // Keep phaseRef in sync for closeSearch to read current phase
  phaseRef.current = state.phase;

  const openSearch = useCallback(() => {
    const el = containerRef.current;
    if (el) clearHighlights(el);
    matchesRef.current = [];
    setState((prev) => ({
      ...initialState,
      phase: 'inputting',
      savedScrollTop: el?.scrollTop ?? prev.savedScrollTop,
    }));
  }, [containerRef]);

  const closeSearch = useCallback(() => {
    const el = containerRef.current;
    if (el) clearHighlights(el);
    matchesRef.current = [];

    setState((prev) => {
      if (prev.phase === 'inputting' && el) {
        el.scrollTop = prev.savedScrollTop;
      }
      // confirmed → idle: keep current scrollTop (don't restore)
      return initialState;
    });
  }, [containerRef]);

  const confirmSearch = useCallback(() => {
    setState((prev) => {
      if (!prev.query.trim()) {
        // Empty query — go back to idle
        const el = containerRef.current;
        if (el) {
          clearHighlights(el);
          el.scrollTop = prev.savedScrollTop;
        }
        matchesRef.current = [];
        return initialState;
      }
      return { ...prev, phase: 'confirmed' };
    });
  }, [containerRef]);

  const search = useCallback((query: string) => {
    const el = containerRef.current;
    if (!el) return;
    const matches = highlightMatches(el, query);
    matchesRef.current = matches;
    const currentIndex = 0;
    if (matches.length > 0) {
      scrollToMatch(el, matches, currentIndex);
    }
    setState((prev) => ({ ...prev, query, matches, currentIndex }));
  }, [containerRef]);

  const nextMatch = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    setState((prev) => {
      const nextIndex = (prev.currentIndex + 1) % prev.matches.length;
      scrollToMatch(el, matchesRef.current, nextIndex);
      return { ...prev, currentIndex: nextIndex };
    });
  }, [containerRef]);

  const prevMatch = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    setState((prev) => {
      const prevIndex = (prev.currentIndex - 1 + prev.matches.length) % prev.matches.length;
      scrollToMatch(el, matchesRef.current, prevIndex);
      return { ...prev, currentIndex: prevIndex };
    });
  }, [containerRef]);

  return {
    phase: state.phase,
    query: state.query,
    matchCount: state.matches.length,
    currentIndex: state.currentIndex,
    openSearch,
    closeSearch,
    confirmSearch,
    search,
    nextMatch,
    prevMatch,
  };
};
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm test -- --project renderer --reporter verbose tests/renderer/hooks/useSearch.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useSearch.ts tests/renderer/hooks/useSearch.test.ts
git commit -m "refactor(search): redesign useSearch with 3-phase state machine

Replace boolean isOpen with idle/inputting/confirmed phases.
- openSearch saves scrollTop
- confirmSearch transitions to confirmed (keeps highlights)
- closeSearch from inputting restores scrollTop, from confirmed keeps position
- Empty query on Enter returns to idle"
```

---

### Task 3: Redesign SearchBar component for vim-style modes

**Files:**
- Modify: `src/renderer/components/SearchBar.tsx`
- Modify: `src/renderer/styles/search.css`

- [ ] **Step 1: Rewrite SearchBar.tsx**

Replace the entire contents of `src/renderer/components/SearchBar.tsx`:

```tsx
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import type { SearchPhase } from '../hooks/useSearch';

type SearchBarProps = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matchCount: number;
  readonly currentIndex: number;
  readonly onSearch: (query: string) => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
};

const MatchCount: FC<{ readonly query: string; readonly matchCount: number; readonly currentIndex: number }> = ({
  query, matchCount, currentIndex,
}) => {
  if (!query) return null;
  return (
    <span className="search-bar-count">
      {matchCount === 0 ? 'No matches' : `${String(currentIndex + 1)}/${String(matchCount)}`}
    </span>
  );
};

export const SearchBar: FC<SearchBarProps> = ({
  phase, query, matchCount, currentIndex, onSearch, onConfirm, onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'inputting') {
      setInputValue('');
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    }
  }, [phase]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  }, [onClose, onConfirm]);

  if (phase === 'idle') return null;

  if (phase === 'confirmed') {
    return (
      <div className="search-bar search-bar-confirmed">
        <span className="search-bar-query">/{query}</span>
        <MatchCount query={query} matchCount={matchCount} currentIndex={currentIndex} />
      </div>
    );
  }

  // phase === 'inputting'
  return (
    <div className="search-bar search-bar-inputting">
      <span className="search-bar-prefix">/</span>
      <input
        ref={inputRef}
        className="search-bar-input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onSearch(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <MatchCount query={inputValue} matchCount={matchCount} currentIndex={currentIndex} />
    </div>
  );
};
```

- [ ] **Step 2: Rewrite search.css for bottom-left positioning**

Replace the entire contents of `src/renderer/styles/search.css`:

```css
.search-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background-color: var(--color-code-bg);
  border-top: 1px solid var(--color-divider);
  font-family: var(--font-code);
  font-size: 13px;
  z-index: 200;
  min-width: 200px;
}

.search-bar-prefix {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.search-bar-input {
  font-family: var(--font-code);
  font-size: 13px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  outline: none;
  flex: 1;
  min-width: 100px;
}

.search-bar-query {
  color: var(--color-text);
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-bar-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
  flex-shrink: 0;
}

mark.search-highlight {
  background-color: var(--color-selection);
  color: inherit;
  border-radius: 2px;
  padding: 1px 0;
}

mark.search-highlight-active {
  background-color: var(--color-link);
  color: #fff;
}
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SearchBar.tsx src/renderer/styles/search.css
git commit -m "feat(search): redesign SearchBar with vim-style bottom-left layout

- inputting mode: / prefix + text input + match count
- confirmed mode: read-only query display + match count
- Remove navigation buttons (keyboard-only operation)
- Move from top-right fixed to bottom-left absolute position"
```

---

### Task 4: Update MarkdownView keybinding integration

**Files:**
- Modify: `src/renderer/components/MarkdownView.tsx`

- [ ] **Step 1: Update MarkdownView to use new useSearch API**

In `src/renderer/components/MarkdownView.tsx`, update the destructuring of `useSearch` (around line 51-54) and the SearchBar props (around line 151-159).

Replace the `useSearch` destructuring:

```typescript
  const {
    phase, query: searchQuery, matchCount, currentIndex,
    openSearch, closeSearch, confirmSearch, search, nextMatch, prevMatch,
  } = useSearch(containerRef);
```

Update the `handleVimKeys` callback. Replace the current `handleVimKeys` (lines 82-142):

```typescript
  const handleVimKeys = useCallback((e: KeyboardEvent) => {
    if (phase === 'inputting') return;

    const el = containerRef.current;
    if (!el) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const step = scrollSettings.stepLines * LINE_HEIGHT;
    const page = scrollSettings.pageLines * LINE_HEIGHT;

    const code = e.code;

    switch (code) {
      case 'KeyJ':
        e.preventDefault();
        el.scrollTop += step;
        break;
      case 'KeyK':
        e.preventDefault();
        el.scrollTop -= step;
        break;
      case 'KeyD':
        e.preventDefault();
        el.scrollTop += page;
        break;
      case 'KeyU':
        e.preventDefault();
        el.scrollTop -= page;
        break;
      case 'KeyG':
        if (e.shiftKey) {
          e.preventDefault();
          el.scrollTop = el.scrollHeight;
        } else if (pendingGRef.current) {
          e.preventDefault();
          el.scrollTop = 0;
          pendingGRef.current = false;
        } else {
          pendingGRef.current = true;
          setTimeout(() => { pendingGRef.current = false; }, 500);
        }
        break;
      case 'KeyN':
        if (phase === 'confirmed') {
          e.preventDefault();
          if (e.shiftKey) {
            prevMatch();
          } else {
            nextMatch();
          }
        }
        break;
      case 'Slash':
        e.preventDefault();
        openSearch();
        break;
      case 'Escape':
        if (phase === 'confirmed') {
          e.preventDefault();
          closeSearch();
        }
        break;
    }
  }, [scrollSettings, phase, openSearch, closeSearch, nextMatch, prevMatch]);
```

Update the SearchBar JSX. Replace the current `<SearchBar ... />` block:

```tsx
      <SearchBar
        phase={phase}
        query={searchQuery}
        matchCount={matchCount}
        currentIndex={currentIndex}
        onSearch={search}
        onConfirm={confirmSearch}
        onClose={closeSearch}
      />
```

- [ ] **Step 2: Remove unused imports if any**

Check that `isSearchOpen` is no longer referenced. The old prop names (`isOpen`, `onNext`, `onPrev`, `currentMatch`) should no longer exist.

- [ ] **Step 3: Run all tests**

Run: `pnpm test -- --project renderer --reporter verbose`
Expected: ALL PASS

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MarkdownView.tsx
git commit -m "feat(search): wire vim-style keybindings to state machine

- n/N only navigate in confirmed phase
- Escape from confirmed clears search
- / works from both idle and confirmed phases
- Enter in SearchBar confirms search (closes input, keeps highlights)"
```

---

### Task 5: E2E tests and build verification

**Files:**
- Create: `tests/e2e/search.spec.ts` (if E2E search tests don't exist)

- [ ] **Step 1: Check for existing E2E test patterns**

Read an existing E2E test to follow the pattern:
```bash
ls tests/e2e/
```

- [ ] **Step 2: Write E2E test for vim-style search flow**

Create `tests/e2e/search.spec.ts` following the existing E2E test patterns. The tests should cover:

1. Press `/` → search bar appears at bottom-left
2. Type a query → highlights appear in real-time
3. Press `Enter` → search bar switches to indicator mode
4. Press `n` → navigates to next match, count updates
5. Press `N` (Shift+n) → navigates to previous match
6. Press `Escape` → highlights cleared, indicator gone

The exact code depends on the E2E setup discovered in step 1. Follow existing patterns for launching the Electron app and interacting with it.

- [ ] **Step 3: Run E2E tests**

Run: `pnpm build && pnpm test:e2e`
Expected: ALL PASS

- [ ] **Step 4: Build the app**

Run: `pnpm run build:app`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/search.spec.ts
git commit -m "test(search): add E2E tests for vim-style search workflow"
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/hooks/useSearch.ts` | Rewrite | 3-phase state machine, multi-match bug fix |
| `src/renderer/components/SearchBar.tsx` | Rewrite | Dual-mode (input/indicator), bottom-left |
| `src/renderer/components/MarkdownView.tsx` | Modify | New keybinding logic for phase-aware behavior |
| `src/renderer/styles/search.css` | Rewrite | Bottom-left positioning, remove button styles |
| `tests/renderer/hooks/useSearch.test.ts` | Create | Pure function + state machine tests |
| `tests/e2e/search.spec.ts` | Create | Full search workflow E2E test |
