import { useState, useEffect } from 'react';
import { lightTheme } from '../themes/light';
import { darkTheme } from '../themes/dark';
import { applyTheme } from '../themes/applyTheme';
import type { Theme } from '../themes/types';
import type { AppSettings, ThemeOverrides } from '../../shared/types';

const themeMap = { light: lightTheme, dark: darkTheme } as const;

const mergeTheme = (base: Theme, overrides?: ThemeOverrides): Theme => {
  if (!overrides) return base;
  return {
    ...base,
    fonts: { ...base.fonts, ...overrides.fonts },
    colors: { ...base.colors, ...overrides.colors },
  };
};

export const useTheme = () => {
  const [theme, setTheme] = useState(lightTheme);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load settings once
  useEffect(() => {
    void window.api.invoke('settings:get').then(setSettings);
  }, []);

  useEffect(() => {
    const applyMode = (mode: 'light' | 'dark') => {
      const base = themeMap[mode];
      const overrides = mode === 'light' ? settings?.lightTheme : settings?.darkTheme;
      const merged = mergeTheme(base, overrides);
      setTheme(merged);
      applyTheme(merged);
    };

    void window.api.invoke('theme:get-system').then(applyMode);

    const unsubscribe = window.api.on('theme:on-change', (mode: unknown) => {
      if (mode === 'light' || mode === 'dark') {
        applyMode(mode);
      }
    });

    return unsubscribe;
  }, [settings]);

  return { theme };
};
