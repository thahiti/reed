import { describe, it, expect } from 'vitest';
import { allMermaidSettled } from '../../src/renderer/components/mermaidSettled';

const html = (markup: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
};

describe('allMermaidSettled', () => {
  it('is true when there are no mermaid diagrams', () => {
    expect(allMermaidSettled(html('<p>hello</p>'))).toBe(true);
  });

  it('is true when every diagram contains an svg', () => {
    expect(
      allMermaidSettled(
        html('<div data-testid="mermaid-diagram"><svg></svg></div>'),
      ),
    ).toBe(true);
  });

  it('is false when a diagram has no svg yet', () => {
    expect(
      allMermaidSettled(
        html('<div data-testid="mermaid-diagram"></div>'),
      ),
    ).toBe(false);
  });
});
