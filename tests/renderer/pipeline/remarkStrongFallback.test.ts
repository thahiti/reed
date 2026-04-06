import { describe, it, expect } from 'vitest';
import { processMarkdown } from '../../../src/renderer/pipeline/createProcessor';

describe('remarkStrongFallback', () => {
  it('should render bold when closing ** follows punctuation and precedes non-space', () => {
    const result = processMarkdown('크기의 **정보 단위(Chunk)**로 분할');
    const json = JSON.stringify(result);
    expect(json).toContain('strong');
    expect(json).toContain('정보 단위(Chunk)');
  });

  it('should handle quoted content before closing **', () => {
    const result = processMarkdown("크기의 **'정보 단위(Chunk)'**로 분할");
    const json = JSON.stringify(result);
    expect(json).toContain('strong');
    expect(json).toContain("'정보 단위(Chunk)'");
  });

  it('should not affect already-parsed bold', () => {
    const result = processMarkdown('크기의 **bold** 로 분할');
    const json = JSON.stringify(result);
    expect(json).toContain('strong');
    expect(json).toContain('bold');
  });

  it('should handle multiple unparsed bold patterns', () => {
    const result = processMarkdown('**A(1)**과 **B(2)**는');
    const json = JSON.stringify(result);
    const strongCount = (json.match(/strong/g) ?? []).length;
    expect(strongCount).toBeGreaterThanOrEqual(2);
    expect(json).toContain('A(1)');
    expect(json).toContain('B(2)');
  });

  it('should preserve surrounding text', () => {
    const result = processMarkdown('앞 **bold(x)**뒤');
    const json = JSON.stringify(result);
    expect(json).toContain('strong');
    expect(json).toContain('앞');
    expect(json).toContain('뒤');
  });

  it('should not touch text without ** patterns', () => {
    const result = processMarkdown('일반 텍스트입니다');
    const json = JSON.stringify(result);
    expect(json).not.toContain('strong');
  });

  it('should handle single ** without closing pair', () => {
    const result = processMarkdown('이것은 ** 닫히지 않는 패턴');
    const json = JSON.stringify(result);
    expect(json).not.toContain('"type":"strong"');
  });
});
