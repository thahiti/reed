import type { FC, HTMLAttributes, PropsWithChildren, ReactNode } from 'react';

type HeadingProps = PropsWithChildren<
  HTMLAttributes<HTMLHeadingElement> & {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  }
>;

const toAnchorId = (children: ReactNode): string => {
  const text = typeof children === 'string' ? children : '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

const tagMap = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<1 | 2 | 3 | 4 | 5 | 6, string>;

export const Heading: FC<HeadingProps> = ({ level, children, ...rest }) => {
  const Tag = tagMap[level];
  const id = toAnchorId(children);
  const levelStr = String(level);
  return (
    <Tag className={`heading heading-${levelStr}`} id={id} {...rest}>
      {children}
    </Tag>
  );
};
