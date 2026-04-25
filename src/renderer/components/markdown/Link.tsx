import { type FC, type PropsWithChildren, type MouseEvent, useContext } from 'react';
import { NavigationContext } from '../../contexts/NavigationContext';

type LinkProps = PropsWithChildren<{
  readonly href: string;
}>;

const isExternalUrl = (href: string): boolean =>
  href.startsWith('http://') || href.startsWith('https://');

const isAnchor = (href: string): boolean => href.startsWith('#');

const isMarkdownLink = (href: string): boolean => {
  const pathPart = href.split('#')[0] ?? '';
  return pathPart.endsWith('.md') || pathPart.endsWith('.markdown');
};

const safeDecode = (s: string): string => {
  try { return decodeURIComponent(s); } catch { return s; }
};

export const Link: FC<LinkProps> = ({ href, children }) => {
  const { onNavigate, flashTargetHref } = useContext(NavigationContext);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    if (isAnchor(href)) {
      e.preventDefault();
      const id = safeDecode(href.slice(1));
      const target = document.getElementById(id);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: 'start' });
      }
      return;
    }
    e.preventDefault();
    if (isExternalUrl(href)) {
      void window.api.invoke('file:open-external', href);
      return;
    }
    if (isMarkdownLink(href)) {
      onNavigate(href);
    }
  };

  const className = flashTargetHref === href ? 'link link-flash' : 'link';

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
};
