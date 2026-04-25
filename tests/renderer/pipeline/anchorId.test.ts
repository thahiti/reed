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

  it('preserves Korean characters', () => {
    expect(toAnchorId('1. 문서 개요')).toBe('1-문서-개요');
  });

  it('preserves Korean with mixed Latin in parens', () => {
    expect(toAnchorId('3. 정상 상태 기준 (Baseline)')).toBe('3-정상-상태-기준-baseline');
  });

  it('preserves CJK characters', () => {
    expect(toAnchorId('日本語 테스트')).toBe('日本語-테스트');
  });
});
