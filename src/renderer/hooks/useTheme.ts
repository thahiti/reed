import { useState, useEffect } from 'react';
import { lightTheme } from '../themes/light';
import { darkTheme } from '../themes/dark';
import { applyTheme } from '../themes/applyTheme';

const themeMap = { light: lightTheme, dark: darkTheme } as const;

export const useTheme = () => {
  const [theme, setTheme] = useState(lightTheme);

  useEffect(() => {
    void window.api.invoke('theme:get-system').then((mode) => {
      const resolved = themeMap[mode];
      setTheme(resolved);
      applyTheme(resolved);
    });

    const unsubscribe = window.api.on('theme:on-change', (mode: unknown) => {
      if (mode === 'light' || mode === 'dark') {
        const resolved = themeMap[mode];
        setTheme(resolved);
        applyTheme(resolved);
      }
    });

    return unsubscribe;
  }, []);

  return { theme };
};
