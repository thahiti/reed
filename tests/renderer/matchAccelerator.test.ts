import { describe, it, expect } from 'vitest';
import { matchAccelerator } from '../../src/renderer/matchAccelerator';

const makeKeyEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key: '',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  }) as unknown as KeyboardEvent;

describe('matchAccelerator', () => {
  describe('simple key', () => {
    it('should match single letter key', () => {
      const e = makeKeyEvent({ key: 't' });
      expect(matchAccelerator(e, 'T', true)).toBe(true);
    });

    it('should not match when modifier is pressed for simple key', () => {
      const e = makeKeyEvent({ key: 't', metaKey: true });
      expect(matchAccelerator(e, 'T', true)).toBe(false);
    });
  });

  describe('CmdOrCtrl modifier', () => {
    it('should match CmdOrCtrl+O with metaKey on Mac', () => {
      const e = makeKeyEvent({ key: 'o', metaKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', true)).toBe(true);
    });

    it('should not match CmdOrCtrl+O without metaKey on Mac', () => {
      const e = makeKeyEvent({ key: 'o' });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', true)).toBe(false);
    });

    it('should match CmdOrCtrl+O with ctrlKey on non-Mac', () => {
      const e = makeKeyEvent({ key: 'o', ctrlKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', false)).toBe(true);
    });

    it('should not match CmdOrCtrl+O with metaKey on non-Mac', () => {
      const e = makeKeyEvent({ key: 'o', metaKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', false)).toBe(false);
    });
  });

  describe('Ctrl modifier', () => {
    it('should match Ctrl+, on Mac with ctrlKey', () => {
      const e = makeKeyEvent({ key: ',', ctrlKey: true });
      expect(matchAccelerator(e, 'Ctrl+,', true)).toBe(true);
    });

    it('should not match Ctrl+, on Mac with metaKey', () => {
      const e = makeKeyEvent({ key: ',', metaKey: true });
      expect(matchAccelerator(e, 'Ctrl+,', true)).toBe(false);
    });
  });

  describe('special keys', () => {
    it('should match comma key', () => {
      const e = makeKeyEvent({ key: ',', ctrlKey: true });
      expect(matchAccelerator(e, 'Ctrl+,', true)).toBe(true);
    });

    it('should match period key', () => {
      const e = makeKeyEvent({ key: '.', ctrlKey: true });
      expect(matchAccelerator(e, 'Ctrl+.', true)).toBe(true);
    });

    it('should match slash key', () => {
      const e = makeKeyEvent({ key: '/', metaKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+/', true)).toBe(true);
    });
  });

  describe('Shift modifier', () => {
    it('should match when shift is required and pressed', () => {
      const e = makeKeyEvent({ key: 'N', metaKey: true, shiftKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+Shift+N', true)).toBe(true);
    });

    it('should not match when shift is required but not pressed', () => {
      const e = makeKeyEvent({ key: 'n', metaKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+Shift+N', true)).toBe(false);
    });
  });

  describe('Alt modifier', () => {
    it('should match when alt is required and pressed', () => {
      const e = makeKeyEvent({ key: 'o', altKey: true, metaKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+Alt+O', true)).toBe(true);
    });
  });

  describe('unwanted modifier rejection', () => {
    it('should not match when extra shift is pressed', () => {
      const e = makeKeyEvent({ key: 'o', metaKey: true, shiftKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', true)).toBe(false);
    });

    it('should not match when extra alt is pressed', () => {
      const e = makeKeyEvent({ key: 'o', metaKey: true, altKey: true });
      expect(matchAccelerator(e, 'CmdOrCtrl+O', true)).toBe(false);
    });
  });
});
