import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels } from '../shared/types';

const api = {
  invoke: <K extends keyof IpcChannels>(
    channel: K,
    ...args: IpcChannels[K]['args']
  ): Promise<IpcChannels[K]['return']> =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: readonly unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: readonly unknown[]) =>
      { callback(...args); };
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
