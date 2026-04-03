import type { FC, PropsWithChildren } from 'react';

type ListProps = PropsWithChildren<{
  readonly ordered?: boolean;
}>;

export const List: FC<ListProps> = ({ ordered, children }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className="list">{children}</Tag>;
};

export const ListItem: FC<PropsWithChildren> = ({ children }) => (
  <li className="list-item">{children}</li>
);
