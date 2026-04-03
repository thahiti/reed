import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from '../../../src/renderer/themes/applyTheme';
import { lightTheme } from '../../../src/renderer/themes/light';
import { darkTheme } from '../../../src/renderer/themes/dark';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('should set CSS variables from light theme', () => {
    applyTheme(lightTheme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-bg')).toBe(lightTheme.colors.bg);
    expect(style.getPropertyValue('--color-text')).toBe(lightTheme.colors.text);
    expect(style.getPropertyValue('--font-body')).toBe(lightTheme.fonts.body);
  });

  it('should set CSS variables from dark theme', () => {
    applyTheme(darkTheme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-bg')).toBe(darkTheme.colors.bg);
    expect(style.getPropertyValue('--color-text')).toBe(darkTheme.colors.text);
  });

  it('should set heading scale variables', () => {
    applyTheme(lightTheme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--heading-h1')).toBe(lightTheme.headingScale.h1);
    expect(style.getPropertyValue('--heading-h6')).toBe(lightTheme.headingScale.h6);
  });

  it('should override previous theme when called again', () => {
    applyTheme(lightTheme);
    applyTheme(darkTheme);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-bg')).toBe(darkTheme.colors.bg);
  });
});
