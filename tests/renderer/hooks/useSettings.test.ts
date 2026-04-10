import { describe, it, expect } from 'vitest';
import { sanitizeTocSettings } from '../../../src/renderer/hooks/useSettings';
import { defaultTocSettings } from '../../../src/shared/types/toc';

describe('sanitizeTocSettings', () => {
  it('returns defaults when input is undefined', () => {
    expect(sanitizeTocSettings(undefined)).toEqual(defaultTocSettings);
  });

  it('falls back to right when position is invalid', () => {
    const result = sanitizeTocSettings({ position: 'middle' as never });
    expect(result.position).toBe('right');
  });

  it('preserves valid left position', () => {
    expect(sanitizeTocSettings({ position: 'left' }).position).toBe('left');
  });

  it('swaps minLevel and maxLevel when reversed', () => {
    const result = sanitizeTocSettings({ minLevel: 5, maxLevel: 2 });
    expect(result.minLevel).toBe(2);
    expect(result.maxLevel).toBe(5);
  });

  it('clamps out-of-range levels', () => {
    const result = sanitizeTocSettings({ minLevel: 0 as never, maxLevel: 9 as never });
    expect(result.minLevel).toBeGreaterThanOrEqual(1);
    expect(result.maxLevel).toBeLessThanOrEqual(6);
  });

  it('coerces non-boolean visible to false', () => {
    const result = sanitizeTocSettings({ visible: 'yes' as never });
    expect(result.visible).toBe(false);
  });

  it('preserves visible=true', () => {
    const result = sanitizeTocSettings({ visible: true });
    expect(result.visible).toBe(true);
  });
});
