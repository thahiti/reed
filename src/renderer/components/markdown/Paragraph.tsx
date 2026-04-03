import type { FC, PropsWithChildren } from 'react';

export const Paragraph: FC<PropsWithChildren> = ({ children }) => (
  <p className="paragraph">{children}</p>
);
