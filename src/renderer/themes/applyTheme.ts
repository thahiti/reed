import type { Theme } from './types';

export const applyTheme = (theme: Theme): void => {
  const style = document.documentElement.style;

  // Fonts
  style.setProperty('--font-body', theme.fonts.body);
  style.setProperty('--font-code', theme.fonts.code);
  style.setProperty('--font-body-size', theme.fonts.bodySize);
  style.setProperty('--font-code-size', theme.fonts.codeSize);
  style.setProperty('--line-height', theme.fonts.lineHeight);
  style.setProperty('--code-line-height', theme.fonts.codeLineHeight);

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    style.setProperty(`--color-${cssKey}`, value);
  });

  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    style.setProperty(`--spacing-${cssKey}`, value);
  });

  // Heading scale
  Object.entries(theme.headingScale).forEach(([key, value]) => {
    style.setProperty(`--heading-${key}`, value);
  });
};
