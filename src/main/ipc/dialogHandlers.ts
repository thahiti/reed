import { ipcMain, dialog, BrowserWindow } from 'electron';

export const showConfirmCloseDialog = async (message: string): Promise<number> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showMessageBox(focusedWindow ?? new BrowserWindow(), {
    type: 'warning',
    buttons: ['저장', '저장 안 함', '취소'],
    defaultId: 0,
    cancelId: 2,
    message,
  });
  return result.response;
};

export const registerDialogHandlers = (): void => {
  ipcMain.handle('dialog:confirm-close', (_event, message: string) =>
    showConfirmCloseDialog(message),
  );
};
