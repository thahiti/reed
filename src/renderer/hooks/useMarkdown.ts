import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { processMarkdown } from '../pipeline/createProcessor';

export const useMarkdown = (content: string): ReactElement =>
  useMemo(() => processMarkdown(content), [content]);
