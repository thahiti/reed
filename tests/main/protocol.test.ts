import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  protocol: { handle: vi.fn() },
  net: { fetch: vi.fn() },
}));

import { getMimeType, ALLOWED_EXTENSIONS } from '../../src/main/protocol';

describe('protocol', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('should include common image extensions', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.png');
      expect(ALLOWED_EXTENSIONS).toContain('.jpg');
      expect(ALLOWED_EXTENSIONS).toContain('.jpeg');
      expect(ALLOWED_EXTENSIONS).toContain('.gif');
      expect(ALLOWED_EXTENSIONS).toContain('.svg');
      expect(ALLOWED_EXTENSIONS).toContain('.webp');
      expect(ALLOWED_EXTENSIONS).toContain('.bmp');
      expect(ALLOWED_EXTENSIONS).toContain('.ico');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for png', () => {
      expect(getMimeType('.png')).toBe('image/png');
    });

    it('should return correct MIME type for svg', () => {
      expect(getMimeType('.svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME type for jpg', () => {
      expect(getMimeType('.jpg')).toBe('image/jpeg');
    });

    it('should return correct MIME type for jpeg', () => {
      expect(getMimeType('.jpeg')).toBe('image/jpeg');
    });

    it('should return octet-stream for unknown extension', () => {
      expect(getMimeType('.xyz')).toBe('application/octet-stream');
    });
  });
});
