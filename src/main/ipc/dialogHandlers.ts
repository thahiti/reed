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

export const showConfirmReloadDialog = async (fileName: string): Promise<boolean> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showMessageBox(focusedWindow ?? new BrowserWindow(), {
    type: 'question',
    buttons: ['다시 로드', '무시'],
    defaultId: 0,
    cancelId: 1,
    message: `"${fileName}" 파일이 외부에서 수정되었습니다.`,
    detail: '다시 로드하면 현재 편집 내용이 사라집니다.',
  });
  return result.response === 0;
};

export const registerDialogHandlers = (): void => {
  ipcMain.handle('dialog:confirm-close', (_event, message: string) =>
    showConfirmCloseDialog(message),
  );

  ipcMain.handle('dialog:confirm-reload', (_event, fileName: string) =>
    showConfirmReloadDialog(fileName),
  );
};
