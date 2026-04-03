import type { FC, HTMLAttributes, PropsWithChildren } from 'react';

type ListProps = PropsWithChildren<
  HTMLAttributes<HTMLUListElement | HTMLOListElement> & {
    readonly ordered?: boolean;
  }
>;

export const List: FC<ListProps> = ({ ordered, children, ...rest }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className="list" {...rest}>{children}</Tag>;
};

export const ListItem: FC<PropsWithChildren> = ({ children }) => (
  <li className="list-item">{children}</li>
);
