import { isValidElement, type FC, type HTMLAttributes, type PropsWithChildren, type ReactNode } from 'react';
import { toAnchorId } from '../../pipeline/anchorId';

type HeadingProps = PropsWithChildren<
  HTMLAttributes<HTMLHeadingElement> & {
    readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  }
>;

// React's element props type is `{}`, so narrowing `children` to ReactNode
// requires one unavoidable cast after isValidElement.
const extractText = (node: ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
    const children = (node.props as { children?: ReactNode }).children;
    return extractText(children);
  }
  return '';
};

const tagMap = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<1 | 2 | 3 | 4 | 5 | 6, string>;

export const Heading: FC<HeadingProps> = ({ level, children, id: idFromProps, ...rest }) => {
  const Tag = tagMap[level];
  const id = idFromProps ?? toAnchorId(extractText(children));
  const levelStr = String(level);
  return (
    <Tag className={`heading heading-${levelStr}`} id={id} {...rest}>
      {children}
    </Tag>
  );
};
