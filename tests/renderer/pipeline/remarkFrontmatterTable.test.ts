import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../../src/renderer/pipeline/remarkFrontmatterTable';

describe('remarkFrontmatterTable', () => {
  it('should parse valid YAML into JSON string', () => {
    const yaml = 'title: Hello\nauthor: Randy';
    const result = parseFrontmatter(yaml);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.title).toBe('Hello');
    expect(parsed.author).toBe('Randy');
  });

  it('should parse YAML with array values', () => {
    const yaml = 'tags:\n  - electron\n  - react';
    const result = parseFrontmatter(yaml);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result) as Record<string, unknown>;
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
