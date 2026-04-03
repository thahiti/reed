import { type FC, useEffect, useRef } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';

type MarkdownViewProps = {
  readonly content: string;
  readonly initialScrollRatio?: number;
  readonly onScrollRatioChange?: (ratio: number) => void;
};

export const MarkdownView: FC<MarkdownViewProps> = ({ content, initialScrollRatio, onScrollRatioChange }) => {
  const rendered = useMarkdown(content);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || initialScrollRatio === undefined) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    el.scrollTop = scrollable * initialScrollRatio;
  }, [initialScrollRatio]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onScrollRatioChange) return;
    const handleScroll = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      const ratio = scrollable > 0 ? el.scrollTop / scrollable : 0;
      onScrollRatioChange(ratio);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); };
  }, [onScrollRatioChange]);

  return (
    <div className="markdown-view" ref={containerRef}>
      <div className="markdown-content">{rendered}</div>
    </div>
  );
};
