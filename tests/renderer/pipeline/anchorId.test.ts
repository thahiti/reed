import { describe, it, expect } from 'vitest';
import { toAnchorId } from '../../../src/renderer/pipeline/anchorId';

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
