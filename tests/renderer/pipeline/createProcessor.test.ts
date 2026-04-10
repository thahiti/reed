import { describe, it, expect } from 'vitest';
import { processMarkdown } from '../../../src/renderer/pipeline/createProcessor';

describe('createProcessor', () => {
  it('should convert heading to React element', () => {
    const { rendered: result } = processMarkdown('# Hello');
    expect(result).toBeDefined();
  });

  it('should convert paragraph to React element', () => {
    const { rendered: result } = processMarkdown('Hello world');
    expect(result).toBeDefined();
  });

  it('should handle GFM table', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { rendered: result } = processMarkdown(md);
    expect(result).toBeDefined();
  });

  it('should handle empty string', () => {
    const { rendered: result } = processMarkdown('');
    expect(result).toBeDefined();
  });

  it('should handle inline code', () => {
    const { rendered: result } = processMarkdown('Use `const` keyword');
    expect(result).toBeDefined();
  });

  it('should handle code block with language', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const { rendered: result } = processMarkdown(md);
    expect(result).toBeDefined();
  });

  it('should resolve image src with basePath', () => {
    const md = '![alt](images/pic.png)';
    const { rendered: result } = processMarkdown(md, '/Users/randy/docs/readme.md');
    expect(result).toBeDefined();
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('md-image:///Users/randy/docs/images/pic.png');
  });

  it('should leave external image URLs unchanged', () => {
    const md = '![alt](https://example.com/pic.png)';
    const { rendered: result } = processMarkdown(md, '/Users/randy/docs/readme.md');
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('https://example.com/pic.png');
  });

  it('should render bold when closing ** follows punctuation and precedes non-space', () => {
    const md = '크기의 **정보 단위(Chunk)**로 분할';
    const { rendered: result } = processMarkdown(md);
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('strong');
    expect(rendered).toContain('정보 단위(Chunk)');
  });

  it('should render frontmatter as FrontmatterTable component', () => {
    const md = '---\ntitle: Hello\nauthor: Randy\n---\n\n# Content';
    const { rendered: result } = processMarkdown(md);
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('frontmatter-table');
    expect(rendered).toContain('Hello');
    expect(rendered).toContain('Randy');
  });

  it('should render frontmatter array values', () => {
    const md = '---\ntags:\n  - electron\n  - react\n---\n\n# Content';
    const { rendered: result } = processMarkdown(md);
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('frontmatter-badge');
    expect(rendered).toContain('electron');
    expect(rendered).toContain('react');
  });

  it('should handle markdown without frontmatter', () => {
    const md = '# Just a heading';
    const { rendered: result } = processMarkdown(md);
    const rendered = JSON.stringify(result);
    expect(rendered).not.toContain('frontmatter-table');
  });

  it('should return collected headings alongside rendered output', () => {
    const md = '# Top\n\n## Alpha\n\n### Alpha sub\n\n## Beta';
    const { headings } = processMarkdown(md);
    expect(headings).toEqual([
      { level: 1, id: 'top', text: 'Top' },
      { level: 2, id: 'alpha', text: 'Alpha' },
      { level: 3, id: 'alpha-sub', text: 'Alpha sub' },
      { level: 2, id: 'beta', text: 'Beta' },
    ]);
  });

  it('should return empty headings when markdown has none', () => {
    const { headings } = processMarkdown('just text');
    expect(headings).toEqual([]);
  });
});
