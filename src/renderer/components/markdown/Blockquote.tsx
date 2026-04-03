import type { FC, BlockquoteHTMLAttributes, PropsWithChildren } from 'react';

type BlockquoteProps = PropsWithChildren<BlockquoteHTMLAttributes<HTMLQuoteElement>>;

export const Blockquote: FC<BlockquoteProps> = ({ children, ...rest }) => (
  <blockquote className="blockquote" {...rest}>{children}</blockquote>
);
