import { describe, it, expect, vi } from 'vitest';

// Test the pure highlightMatches function directly
// We need to export it from useSearch.ts for testing
import { highlightMatches, clearHighlights } from '../../../src/renderer/hooks/useSearch';

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
    const mark = marks[0];
    expect(mark).toBeDefined();
    expect(mark?.tagName).toBe('MARK');
    expect(mark?.classList.contains('search-highlight')).toBe(true);
    expect(mark?.textContent).toBe('world');
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

import { renderHook, act } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { useSearch } from '../../../src/renderer/hooks/useSearch';

describe('useSearch state machine', () => {
  beforeAll(() => {
    // jsdom doesn't implement scrollIntoView — assign before spying so the property exists
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });
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
