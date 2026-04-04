import { type FC, useCallback, useEffect, useRef } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';
import type { ScrollSettings } from '../../shared/types';

type MarkdownViewProps = {
  readonly content: string;
  readonly initialLine?: number;
  readonly scrollSettings: ScrollSettings;
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

  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-source-line]'));
  const best = elements.reduce<HTMLElement | undefined>((prev, candidate) => {
    const candidateLine = parseInt(candidate.dataset['sourceLine'] ?? '0', 10);
    return candidateLine <= line ? candidate : prev;
  }, undefined);

  if (best) {
    container.scrollTop = best.offsetTop;
  }
};

export const MarkdownView: FC<MarkdownViewProps> = ({ content, initialLine, scrollSettings, onTopLineChange }) => {
  const rendered = useMarkdown(content);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isSearchOpen, matchCount, currentMatch,
    openSearch, closeSearch, search, nextMatch, prevMatch,
  } = useSearch(containerRef);

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
  const LINE_HEIGHT = 24;

  const handleVimKeys = useCallback((e: KeyboardEvent) => {
    if (isSearchOpen) return;

    const el = containerRef.current;
    if (!el) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const step = scrollSettings.stepLines * LINE_HEIGHT;
    const page = scrollSettings.pageLines * LINE_HEIGHT;

    switch (e.key) {
      case 'j':
        e.preventDefault();
        el.scrollTop += step;
        break;
      case 'k':
        e.preventDefault();
        el.scrollTop -= step;
        break;
      case 'd':
        e.preventDefault();
        el.scrollTop += page;
        break;
      case 'u':
        e.preventDefault();
        el.scrollTop -= page;
        break;
      case 'G':
        e.preventDefault();
        el.scrollTop = el.scrollHeight;
        break;
      case 'g':
        if (pendingGRef.current) {
          e.preventDefault();
          el.scrollTop = 0;
          pendingGRef.current = false;
        } else {
          pendingGRef.current = true;
          setTimeout(() => { pendingGRef.current = false; }, 500);
        }
        break;
      case '/':
        e.preventDefault();
        openSearch();
        break;
      case 'n':
        e.preventDefault();
        nextMatch();
        break;
      case 'N':
        e.preventDefault();
        prevMatch();
        break;
    }
  }, [scrollSettings, isSearchOpen, openSearch, nextMatch, prevMatch]);

  useEffect(() => {
    window.addEventListener('keydown', handleVimKeys);
    return () => { window.removeEventListener('keydown', handleVimKeys); };
  }, [handleVimKeys]);

  return (
    <div className="markdown-view" ref={containerRef}>
      <SearchBar
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSearch={search}
        onNext={nextMatch}
        onPrev={prevMatch}
        matchCount={matchCount}
        currentMatch={currentMatch}
      />
      <div className="markdown-content">{rendered}</div>
    </div>
  );
};
