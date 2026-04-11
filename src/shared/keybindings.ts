export const keybindingActions = [
  'file:new',
  'file:open',
  'file:quick-open',
  'file:save',
  'file:copy-path',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'view:toggle-toc',
  'help:show',
] as const;

export type KeybindingAction = (typeof keybindingActions)[number];

export const defaultKeybindings: Readonly<Record<KeybindingAction, string>> = {
  'file:new': 'CmdOrCtrl+N',
  'file:open': 'CmdOrCtrl+O',
  'file:quick-open': 'CmdOrCtrl+P',
  'file:save': 'CmdOrCtrl+S',
  'file:copy-path': 'C',
  'tab:close': 'CmdOrCtrl+W',
  'tab:prev': 'Ctrl+,',
  'tab:next': 'Ctrl+.',
  'view:toggle-edit': 'T',
  'view:toggle-toc': 'O',
  'help:show': 'CmdOrCtrl+/',
};

export const mergeKeybindings = (
  overrides: Partial<Record<string, string>> | undefined,
): Record<KeybindingAction, string> => ({
  ...defaultKeybindings,
  ...overrides,
});
