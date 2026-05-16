import { describe, it, expect } from 'vitest';
import { derivePdfName } from '../../src/main/ipc/pdfName';

describe('derivePdfName', () => {
  it('replaces .md with .pdf', () => {
    expect(derivePdfName('/a/b/foo.md')).toBe('foo.pdf');
  });

  it('replaces .markdown with .pdf', () => {
    expect(derivePdfName('/a/b.markdown')).toBe('b.pdf');
  });

  it('appends .pdf when there is no extension', () => {
    expect(derivePdfName('/a/noext')).toBe('noext.pdf');
  });

  it('handles a bare filename', () => {
    expect(derivePdfName('foo.md')).toBe('foo.pdf');
  });
});
