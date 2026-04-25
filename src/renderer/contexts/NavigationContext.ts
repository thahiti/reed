import { createContext } from 'react';

export type NavigationContextValue = {
  readonly onNavigate: (href: string) => void;
  readonly flashTargetHref: string | null;
};

const noopNavigate = (): void => {};

export const NavigationContext = createContext<NavigationContextValue>({
  onNavigate: noopNavigate,
  flashTargetHref: null,
});
