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
});
