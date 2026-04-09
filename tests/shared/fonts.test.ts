import { describe, it, expect } from 'vitest';
import {
  bodyFonts,
  codeFonts,
  defaultBodyFontId,
  defaultCodeFontId,
  getBodyFontFamily,
  getCodeFontFamily,
} from '../../src/shared/fonts';

describe('fonts', () => {
  it('should have SUIT as default body font', () => {
    expect(defaultBodyFontId).toBe('suit');
  });

  it('should have JetBrains Mono as default code font', () => {
    expect(defaultCodeFontId).toBe('jetbrains-mono');
  });

  it('should return font family for valid body font id', () => {
    const family = getBodyFontFamily('suit');
    expect(family).toBe("'SUIT Variable', sans-serif");
  });

  it('should return font family for valid code font id', () => {
    const family = getCodeFontFamily('jetbrains-mono');
    expect(family).toBe("'JetBrains Mono', monospace");
  });

  it('should return default body font family for unknown id', () => {
    const family = getBodyFontFamily('nonexistent');
    expect(family).toBe("'SUIT Variable', sans-serif");
  });

  it('should return default code font family for unknown id', () => {
    const family = getCodeFontFamily('nonexistent');
    expect(family).toBe("'JetBrains Mono', monospace");
  });

  it('should have 4 body fonts', () => {
    expect(bodyFonts).toHaveLength(4);
  });

  it('should have 3 code fonts', () => {
    expect(codeFonts).toHaveLength(3);
  });
});
