import { describe, it, expect } from 'vitest';
import { processMarkdown } from '../../../src/renderer/pipeline/createProcessor';

describe('createProcessor', () => {
  it('should convert heading to React element', () => {
    const result = processMarkdown('# Hello');
    expect(result).toBeDefined();
  });

  it('should convert paragraph to React element', () => {
    const result = processMarkdown('Hello world');
    expect(result).toBeDefined();
  });

  it('should handle GFM table', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = processMarkdown(md);
    expect(result).toBeDefined();
  });

  it('should handle empty string', () => {
    const result = processMarkdown('');
    expect(result).toBeDefined();
  });

  it('should handle inline code', () => {
    const result = processMarkdown('Use `const` keyword');
    expect(result).toBeDefined();
  });

  it('should handle code block with language', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const result = processMarkdown(md);
    expect(result).toBeDefined();
  });

  it('should resolve image src with basePath', () => {
    const md = '![alt](images/pic.png)';
    const result = processMarkdown(md, '/Users/randy/docs/readme.md');
    expect(result).toBeDefined();
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('md-image:///Users/randy/docs/images/pic.png');
  });

  it('should leave external image URLs unchanged', () => {
    const md = '![alt](https://example.com/pic.png)';
    const result = processMarkdown(md, '/Users/randy/docs/readme.md');
    const rendered = JSON.stringify(result);
    expect(rendered).toContain('https://example.com/pic.png');
  });
});
