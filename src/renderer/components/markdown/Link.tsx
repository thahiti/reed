import type { FC, PropsWithChildren, MouseEvent } from 'react';

type LinkProps = PropsWithChildren<{
  readonly href: string;
  readonly onOpenFile?: (filePath: string) => void;
}>;

const isExternalUrl = (href: string): boolean =>
  href.startsWith('http://') || href.startsWith('https://');

const isAnchor = (href: string): boolean =>
  href.startsWith('#');

export const Link: FC<LinkProps> = ({ href, onOpenFile, children }) => {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isAnchor(href)) return;

    e.preventDefault();

    if (isExternalUrl(href)) {
      void window.api.invoke('file:open-external', href);
    } else if (onOpenFile) {
      onOpenFile(href);
    }
  };

  return (
    <a className="link" href={href} onClick={handleClick}>
      {children}
    </a>
  );
};
