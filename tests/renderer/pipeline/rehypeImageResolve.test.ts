import { describe, it, expect } from 'vitest';
import { resolveImageSrc } from '../../../src/renderer/pipeline/rehypeImageResolve';

describe('rehypeImageResolve', () => {
  describe('resolveImageSrc', () => {
    const basePath = '/Users/randy/docs/readme.md';

    it('should leave https URLs unchanged', () => {
      expect(resolveImageSrc('https://example.com/pic.png', basePath)).toBe('https://example.com/pic.png');
    });

    it('should leave http URLs unchanged', () => {
      expect(resolveImageSrc('http://example.com/pic.png', basePath)).toBe('http://example.com/pic.png');
    });

    it('should leave data URIs unchanged', () => {
      const dataUri = 'data:image/png;base64,iVBOR...';
      expect(resolveImageSrc(dataUri, basePath)).toBe(dataUri);
    });

    it('should convert relative path to md-image URL', () => {
      expect(resolveImageSrc('images/diagram.svg', basePath))
        .toBe('md-image:///Users/randy/docs/images/diagram.svg');
    });

    it('should convert dot-relative path to md-image URL', () => {
      expect(resolveImageSrc('./images/pic.png', basePath))
        .toBe('md-image:///Users/randy/docs/images/pic.png');
    });

    it('should convert absolute path to md-image URL', () => {
      expect(resolveImageSrc('/Users/other/pic.png', basePath))
        .toBe('md-image:///Users/other/pic.png');
    });

    it('should handle parent directory traversal', () => {
      const base = '/Users/randy/docs/sub/readme.md';
      expect(resolveImageSrc('../images/pic.png', base))
        .toBe('md-image:///Users/randy/docs/images/pic.png');
    });

    it('should return src unchanged when basePath is empty', () => {
      expect(resolveImageSrc('images/pic.png', '')).toBe('images/pic.png');
    });
  });
});
