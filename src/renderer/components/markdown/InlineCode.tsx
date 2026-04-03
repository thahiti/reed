import type { FC, PropsWithChildren } from 'react';

export const InlineCode: FC<PropsWithChildren> = ({ children }) => (
  <code className="inline-code">{children}</code>
);
