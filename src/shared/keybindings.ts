export const keybindingActions = [
  'file:open',
  'file:quick-open',
  'file:save',
  'tab:close',
  'tab:prev',
  'tab:next',
  'view:toggle-edit',
  'help:show',
] as const;

export type KeybindingAction = (typeof keybindingActions)[number];

export const defaultKeybindings: Readonly<Record<KeybindingAction, string>> = {
  'file:open': 'CmdOrCtrl+O',
  'file:quick-open': 'CmdOrCtrl+P',
  'file:save': 'CmdOrCtrl+S',
  'tab:close': 'CmdOrCtrl+W',
  'tab:prev': 'Ctrl+,',
  'tab:next': 'Ctrl+.',
  'view:toggle-edit': 'T',
  'help:show': 'CmdOrCtrl+/',
};

export const mergeKeybindings = (
  overrides: Partial<Record<string, string>> | undefined,
): Record<KeybindingAction, string> => ({
  ...defaultKeybindings,
  ...overrides,
});
