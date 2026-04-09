export type IpcChannels = {
  'file:read': { args: readonly [filePath: string]; return: string };
  'file:open-dialog': { args: readonly []; return: string | null };
  'file:save-dialog': { args: readonly []; return: string | null };
  'file:resolve-path': {
    args: readonly [basePath: string, relativePath: string];
    return: string;
  };
  'file:open-external': { args: readonly [url: string]; return: undefined };
  'file:write': { args: readonly [filePath: string, content: string]; return: undefined };
  'file:watch': { args: readonly [filePath: string]; return: undefined };
  'file:unwatch': { args: readonly [filePath: string]; return: undefined };
  'dialog:confirm-close': { args: readonly [message: string]; return: number };
  'dialog:confirm-reload': { args: readonly [fileName: string]; return: boolean };
  'history:get': { args: readonly []; return: ReadonlyArray<HistoryEntry> };
  'history:add': { args: readonly [filePath: string]; return: undefined };
  'theme:get-system': { args: readonly []; return: 'light' | 'dark' };
  'settings:get': { args: readonly []; return: AppSettings };
  'settings:set': { args: readonly [settings: AppSettings]; return: undefined };
  'settings:open-file': { args: readonly []; return: undefined };
};

export type HistoryEntry = {
  readonly filePath: string;
  readonly fileName: string;
  readonly openedAt: string;
};

export type Tab = {
  readonly id: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
  readonly modified: boolean;
};

export type TabState = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
};

export type ScrollSettings = {
  readonly stepLines: number;
  readonly pageLines: number;
};

export type ThemeOverrides = {
  readonly fonts?: Partial<{
    readonly body: string;
    readonly code: string;
    readonly bodySize: string;
    readonly codeSize: string;
    readonly lineHeight: string;
  }>;
  readonly colors?: Partial<{
    readonly bg: string;
    readonly text: string;
    readonly heading: string;
    readonly link: string;
    readonly codeBg: string;
    readonly codeText: string;
  }>;
};

export type AppSettings = {
  readonly scroll: ScrollSettings;
  readonly bodyFont?: string;
  readonly codeFont?: string;
  readonly lightTheme?: ThemeOverrides;
  readonly darkTheme?: ThemeOverrides;
  readonly keybindings?: Partial<Record<string, string>>;
};
