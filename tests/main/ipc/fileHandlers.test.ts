import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(), getAllWindows: vi.fn(() => []) },
}));

vi.mock('node:fs/promises', () => ({
  default: { readFile: vi.fn() },
  readFile: vi.fn(),
}));

import { readFileContent, resolveRelativePath } from '../../../src/main/ipc/fileHandlers';

import { readFile } from 'node:fs/promises';

describe('fileHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readFileContent', () => {
    it('should read file as utf-8 string', async () => {
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('# Hello' as unknown as Buffer);
      const result = await readFileContent('/path/to/file.md');
      expect(result).toBe('# Hello');
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.md', 'utf-8');
    });
  });

  describe('resolveRelativePath', () => {
    it('should resolve relative path from base file directory', () => {
      const result = resolveRelativePath('/docs/readme.md', './images/logo.png');
      expect(result).toContain('docs');
      expect(result).toContain('images/logo.png');
    });

    it('should reject directory traversal beyond base directory', () => {
      expect(() =>
        resolveRelativePath('/docs/readme.md', '../../../etc/passwd'),
      ).toThrow();
    });

    it('should allow relative path within same directory tree', () => {
      const result = resolveRelativePath('/docs/sub/readme.md', '../images/logo.png');
      expect(result).toContain('docs');
      expect(result).toContain('images/logo.png');
    });
  });
});
