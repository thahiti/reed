import { describe, it, expect } from 'vitest';
import { defaultKeybindings, keybindingActions, mergeKeybindings } from '../../src/shared/keybindings';
import type { KeybindingAction } from '../../src/shared/keybindings';

describe('keybindings', () => {
  it('should return all default keybindings when no overrides', () => {
    const result = mergeKeybindings(undefined);
    expect(result).toEqual(defaultKeybindings);
  });

  it('should override specific keybindings while keeping defaults', () => {
    const overrides: Partial<Record<KeybindingAction, string>> = {
      'tab:prev': 'CmdOrCtrl+Shift+Tab',
    };
    const result = mergeKeybindings(overrides);
    expect(result['tab:prev']).toBe('CmdOrCtrl+Shift+Tab');
    expect(result['file:open']).toBe(defaultKeybindings['file:open']);
  });

  it('should handle empty overrides object', () => {
    const result = mergeKeybindings({});
    expect(result).toEqual(defaultKeybindings);
  });

  it('should include file:new in default keybindings', () => {
    const result = mergeKeybindings(undefined);
    expect(result['file:new']).toBe('CmdOrCtrl+N');
  });

  it('should include file:copy-path with default C', () => {
    const result = mergeKeybindings(undefined);
    expect(result['file:copy-path']).toBe('C');
  });

  it('includes nav:back and nav:forward in actions', () => {
    expect(keybindingActions).toContain('nav:back');
    expect(keybindingActions).toContain('nav:forward');
  });

  it('defaults nav:back to Ctrl+[ and nav:forward to Ctrl+]', () => {
    expect(defaultKeybindings['nav:back']).toBe('Ctrl+[');
    expect(defaultKeybindings['nav:forward']).toBe('Ctrl+]');
  });
});
