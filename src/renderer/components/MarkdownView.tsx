import type { FC } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';

type MarkdownViewProps = {
  readonly content: string;
};

export const MarkdownView: FC<MarkdownViewProps> = ({ content }) => {
  const rendered = useMarkdown(content);

  return (
    <div className="markdown-view">
      <div className="markdown-content">{rendered}</div>
    </div>
  );
};
