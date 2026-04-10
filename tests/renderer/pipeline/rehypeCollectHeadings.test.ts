import { describe, it, expect } from 'vitest';
import type { Root, Element, ElementContent } from 'hast';
import { collectHeadings } from '../../../src/renderer/pipeline/rehypeCollectHeadings';

const text = (value: string): ElementContent => ({ type: 'text', value });

const heading = (tag: string, children: readonly ElementContent[]): Element => ({
  type: 'element',
  tagName: tag,
  properties: {},
  children: [...children],
});

const tree = (children: readonly ElementContent[]): Root => ({
  type: 'root',
  children: [...children],
});

describe('collectHeadings', () => {
  it('collects all heading levels in order', () => {
    const root = tree([
      heading('h1', [text('One')]),
      heading('h2', [text('Two')]),
      heading('h3', [text('Three')]),
    ]);
    expect(collectHeadings(root)).toEqual([
      { level: 1, id: 'one', text: 'One' },
      { level: 2, id: 'two', text: 'Two' },
      { level: 3, id: 'three', text: 'Three' },
    ]);
  });

  it('returns empty array when no headings', () => {
    const root = tree([
      { type: 'element', tagName: 'p', properties: {}, children: [text('just a paragraph')] },
    ]);
    expect(collectHeadings(root)).toEqual([]);
  });

  it('flattens inline elements inside heading text', () => {
    const root = tree([
      heading('h2', [
        text('Use '),
        { type: 'element', tagName: 'code', properties: {}, children: [text('foo')] },
        text(' '),
        { type: 'element', tagName: 'strong', properties: {}, children: [text('boldly')] },
      ]),
    ]);
    expect(collectHeadings(root)).toEqual([
      { level: 2, id: 'use-foo-boldly', text: 'Use foo boldly' },
    ]);
  });

  it('suffixes duplicate ids with -2, -3', () => {
    const root = tree([
      heading('h2', [text('Intro')]),
      heading('h2', [text('Intro')]),
      heading('h2', [text('Intro')]),
    ]);
    expect(collectHeadings(root).map((h) => h.id)).toEqual(['intro', 'intro-2', 'intro-3']);
  });

  it('mutates properties.id on heading nodes', () => {
    const h2 = heading('h2', [text('Hello World')]);
    const root = tree([h2]);
    collectHeadings(root);
    expect(h2.properties.id).toBe('hello-world');
  });

  it('falls back to heading-N id when text is empty', () => {
    const root = tree([heading('h1', [])]);
    expect(collectHeadings(root)).toEqual([
      { level: 1, id: 'heading-1', text: '' },
    ]);
  });

  it('visits nested non-heading elements to find deeper headings', () => {
    const root = tree([
      {
        type: 'element',
        tagName: 'section',
        properties: {},
        children: [heading('h2', [text('Nested')])],
      },
    ]);
    expect(collectHeadings(root)).toEqual([
      { level: 2, id: 'nested', text: 'Nested' },
    ]);
  });
});
