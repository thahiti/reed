import { createContext, useContext, type FC, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const ThemeModeContext = createContext<ThemeMode>('light');

export const useThemeMode = (): ThemeMode => useContext(ThemeModeContext);

type Props = {
  readonly mode: ThemeMode;
  readonly children: ReactNode;
};

export const ThemeModeProvider: FC<Props> = ({ mode, children }) => (
  <ThemeModeContext.Provider value={mode}>{children}</ThemeModeContext.Provider>
);
