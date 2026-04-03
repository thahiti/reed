import { type FC, useCallback, useEffect, useRef } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';

type MarkdownViewProps = {
  readonly content: string;
  readonly initialLine?: number;
  readonly onTopLineChange?: (line: number) => void;
};

const getTopVisibleLine = (container: HTMLElement): number => {
  const elements = container.querySelectorAll<HTMLElement>('[data-source-line]');
  const scrollTop = container.scrollTop;

  let closestLine = 1;
  let closestDistance = Infinity;

  elements.forEach((el) => {
    const distance = Math.abs(el.offsetTop - scrollTop);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestLine = parseInt(el.dataset['sourceLine'] ?? '1', 10);
    }
  });

  return closestLine;
};

const scrollToLine = (container: HTMLElement, line: number): void => {
  const el = container.querySelector<HTMLElement>(`[data-source-line="${String(line)}"]`);
  if (el) {
    container.scrollTop = el.offsetTop;
    return;
  }

  // 정확한 라인이 없으면 가장 가까운 이전 라인을 찾음
  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-source-line]'));
  const best = elements.reduce<HTMLElement | undefined>((prev, candidate) => {
    const candidateLine = parseInt(candidate.dataset['sourceLine'] ?? '0', 10);
    return candidateLine <= line ? candidate : prev;
  }, undefined);

  if (best) {
    container.scrollTop = best.offsetTop;
  }
};

export const MarkdownView: FC<MarkdownViewProps> = ({ content, initialLine, onTopLineChange }) => {
  const rendered = useMarkdown(content);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || initialLine === undefined) return;
    requestAnimationFrame(() => {
      scrollToLine(el, initialLine);
    });
  }, [initialLine]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onTopLineChange) return;
    const handleScroll = () => {
      onTopLineChange(getTopVisibleLine(el));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); };
  }, [onTopLineChange]);

  // Vim-style keyboard navigation
  const pendingGRef = useRef(false);

  const handleVimKeys = useCallback((e: KeyboardEvent) => {
    const el = containerRef.current;
    if (!el) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const STEP = 60;
    const HALF_PAGE = el.clientHeight / 2;

    switch (e.key) {
      case 'j':
        e.preventDefault();
        el.scrollBy({ top: STEP, behavior: 'smooth' });
        break;
      case 'k':
        e.preventDefault();
        el.scrollBy({ top: -STEP, behavior: 'smooth' });
        break;
      case 'd':
        e.preventDefault();
        el.scrollBy({ top: HALF_PAGE, behavior: 'smooth' });
        break;
      case 'u':
        e.preventDefault();
        el.scrollBy({ top: -HALF_PAGE, behavior: 'smooth' });
        break;
      case 'G':
        e.preventDefault();
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        break;
      case 'g':
        if (pendingGRef.current) {
          e.preventDefault();
          el.scrollTo({ top: 0, behavior: 'smooth' });
          pendingGRef.current = false;
        } else {
          pendingGRef.current = true;
          setTimeout(() => { pendingGRef.current = false; }, 500);
        }
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleVimKeys);
    return () => { window.removeEventListener('keydown', handleVimKeys); };
  }, [handleVimKeys]);

  return (
    <div className="markdown-view" ref={containerRef}>
      <div className="markdown-content">{rendered}</div>
    </div>
  );
};
