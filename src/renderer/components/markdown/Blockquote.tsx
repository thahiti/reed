import type { FC, PropsWithChildren } from 'react';

export const Blockquote: FC<PropsWithChildren> = ({ children }) => (
  <blockquote className="blockquote">{children}</blockquote>
);
