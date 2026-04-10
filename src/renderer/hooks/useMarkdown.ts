import { useMemo } from 'react';
import { processMarkdown, type ProcessMarkdownResult } from '../pipeline/createProcessor';

export const useMarkdown = (content: string, basePath = ''): ProcessMarkdownResult =>
  useMemo(() => processMarkdown(content, basePath), [content, basePath]);
