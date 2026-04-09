import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => {
  const mockBrowserWindow = vi.fn(() => ({}));
  mockBrowserWindow.getFocusedWindow = vi.fn();
  mockBrowserWindow.getAllWindows = vi.fn(() => []);
  return {
    ipcMain: { handle: vi.fn() },
    dialog: { showMessageBox: vi.fn() },
    BrowserWindow: mockBrowserWindow,
  };
});

import { dialog } from 'electron';
import { showConfirmCloseDialog, showConfirmReloadDialog } from '../../../src/main/ipc/dialogHandlers';

describe('dialogHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showConfirmCloseDialog', () => {
    it('should return button index from message box', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showMessageBoxMock = vi.mocked(dialog.showMessageBox);
      showMessageBoxMock.mockResolvedValue({
        response: 0,
        checkboxChecked: false,
      });
      const result = await showConfirmCloseDialog('저장하지 않은 내용이 있습니다.');
      expect(result).toBe(0);
      expect(showMessageBoxMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'warning',
          buttons: ['저장', '저장 안 함', '취소'],
        }),
      );
    });

    it('should return 2 when user clicks cancel', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showMessageBoxMock = vi.mocked(dialog.showMessageBox);
      showMessageBoxMock.mockResolvedValue({
        response: 2,
        checkboxChecked: false,
      });
      const result = await showConfirmCloseDialog('저장하지 않은 내용이 있습니다.');
      expect(result).toBe(2);
    });
  });

  describe('showConfirmReloadDialog', () => {
    it('should return true when user clicks reload', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showMessageBoxMock = vi.mocked(dialog.showMessageBox);
      showMessageBoxMock.mockResolvedValue({
        response: 0,
        checkboxChecked: false,
      });
      const result = await showConfirmReloadDialog('test.md');
      expect(result).toBe(true);
      expect(showMessageBoxMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'question',
          buttons: ['다시 로드', '무시'],
        }),
      );
    });

    it('should return false when user clicks ignore', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const showMessageBoxMock = vi.mocked(dialog.showMessageBox);
      showMessageBoxMock.mockResolvedValue({
        response: 1,
        checkboxChecked: false,
      });
      const result = await showConfirmReloadDialog('test.md');
      expect(result).toBe(false);
    });
  });
});
