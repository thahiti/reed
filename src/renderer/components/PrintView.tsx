import { useEffect, useState, type ReactElement } from 'react';
import { processMarkdown } from '../pipeline/createProcessor';
import { applyTheme } from '../themes/applyTheme';
import { lightTheme } from '../themes/light';
import { allMermaidSettled } from './mermaidSettled';

const getPathParam = (): string => {
  const { hash } = window.location;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('path') ?? '';
};

export const PrintView = (): ReactElement => {
  const [rendered, setRendered] = useState<ReactElement | null>(null);

  useEffect(() => {
    applyTheme(lightTheme);
    const path = getPathParam();
    void window.api
      .invoke('file:read', path)
      .then((content) => {
        setRendered(processMarkdown(content, path).rendered);
      });
  }, []);

  useEffect(() => {
    if (!rendered) return undefined;
    let cancelled = false;
    const tick = (): void => {
      if (cancelled) return;
      if (allMermaidSettled(document.body)) {
        void document.fonts.ready.then(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              void window.api.invoke('pdf:print-ready');
            });
          });
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [rendered]);

  return <div className="markdown-content">{rendered}</div>;
};
