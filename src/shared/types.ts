export type IpcChannels = {
  'file:read': { args: readonly [filePath: string]; return: string };
  'file:open-dialog': { args: readonly []; return: string | null };
  'file:resolve-path': {
    args: readonly [basePath: string, relativePath: string];
    return: string;
  };
  'file:open-external': { args: readonly [url: string]; return: undefined };
  'file:write': { args: readonly [filePath: string, content: string]; return: undefined };
  'history:get': { args: readonly []; return: ReadonlyArray<HistoryEntry> };
  'history:add': { args: readonly [filePath: string]; return: undefined };
  'theme:get-system': { args: readonly []; return: 'light' | 'dark' };
};

export type HistoryEntry = {
  readonly filePath: string;
  readonly fileName: string;
  readonly openedAt: string;
};

export type Tab = {
  readonly id: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly content: string;
  readonly modified: boolean;
};

export type TabState = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
};
