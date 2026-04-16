import { describe, it, expect } from 'vitest';

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
