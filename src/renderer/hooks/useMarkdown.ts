import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { processMarkdown } from '../pipeline/createProcessor';

export const useMarkdown = (content: string, basePath = ''): ReactElement =>
  useMemo(() => processMarkdown(content, basePath), [content, basePath]);
