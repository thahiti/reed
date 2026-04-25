import { useState, useEffect, useCallback } from 'react';
import { lightTheme } from '../themes/light';
import { darkTheme } from '../themes/dark';
import { applyTheme } from '../themes/applyTheme';
import type { Theme } from '../themes/types';
import type { AppSettings, ThemeOverrides } from '../../shared/types';
import { getBodyFontFamily, getCodeFontFamily, defaultBodyFontId, defaultCodeFontId } from '../../shared/fonts';

type ThemeMode = 'light' | 'dark';

const themeMap = { light: lightTheme, dark: darkTheme } as const;

const mergeTheme = (base: Theme, overrides?: ThemeOverrides): Theme => {
  if (!overrides) return base;
  return {
    ...base,
    fonts: { ...base.fonts, ...overrides.fonts },
    colors: { ...base.colors, ...overrides.colors },
  };
};

const applyFontSettings = (theme: Theme, settings: AppSettings | null): Theme => {
  const bodyFamily = getBodyFontFamily(settings?.bodyFont ?? defaultBodyFontId);
  const codeFamily = getCodeFontFamily(settings?.codeFont ?? defaultCodeFontId);
  return {
    ...theme,
    fonts: { ...theme.fonts, body: bodyFamily, code: codeFamily },
  };
};

export const useTheme = () => {
  const [theme, setTheme] = useState(lightTheme);
  const [mode, setMode] = useState<ThemeMode>('light');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void window.api.invoke('settings:get').then(setSettings);
  }, []);

  useEffect(() => {
    const applyMode = (next: ThemeMode) => {
      const base = themeMap[next];
      const withFonts = applyFontSettings(base, settings);
      const overrides = next === 'light' ? settings?.lightTheme : settings?.darkTheme;
      const merged = mergeTheme(withFonts, overrides);
      setMode(next);
      setTheme(merged);
      applyTheme(merged);
    };

    void window.api.invoke('theme:get-system').then(applyMode);

    const unsubscribe = window.api.on('theme:on-change', (next: unknown) => {
      if (next === 'light' || next === 'dark') {
        applyMode(next);
      }
    });

    return unsubscribe;
  }, [settings]);

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, []);

  return { theme, mode, updateSettings };
};
