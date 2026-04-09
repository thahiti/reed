import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => {
  const mockBrowserWindow = vi.fn(() => ({}));
  mockBrowserWindow.getFocusedWindow = vi.fn();
  mockBrowserWindow.getAllWindows = vi.fn(() => []);
  return {
    ipcMain: { handle: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    shell: { openExternal: vi.fn() },
    BrowserWindow: mockBrowserWindow,
  };
});

vi.mock('node:fs/promises', () => ({
  default: { readFile: vi.fn() },
  readFile: vi.fn(),
}));

import { readFileContent, resolveRelativePath } from '../../../src/main/ipc/fileHandlers';

import { readFile } from 'node:fs/promises';
import { dialog } from 'electron';

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

  describe('showSaveDialogForMd', () => {
    it('should return file path when user selects a file', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showSaveDialogMock = vi.mocked(dialog.showSaveDialog);
      showSaveDialogMock.mockImplementation(() =>
        Promise.resolve({
          canceled: false,
          filePath: '/path/to/new-file.md',
        }),
      );
      const { showSaveDialogForMd } = await import('../../../src/main/ipc/fileHandlers');
      const result = await showSaveDialogForMd();
      expect(result).toBe('/path/to/new-file.md');
    });

    it('should return null when user cancels', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showSaveDialogMock = vi.mocked(dialog.showSaveDialog);
      showSaveDialogMock.mockImplementation(() =>
        Promise.resolve({
          canceled: true,
          filePath: undefined as unknown as string,
        }),
      );
      const { showSaveDialogForMd } = await import('../../../src/main/ipc/fileHandlers');
      const result = await showSaveDialogForMd();
      expect(result).toBeNull();
    });
  });
});
