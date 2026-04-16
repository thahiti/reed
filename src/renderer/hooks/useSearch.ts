import { useState, useCallback, useRef } from 'react';

type SearchState = {
  readonly isOpen: boolean;
  readonly query: string;
  readonly matches: ReadonlyArray<Element>;
  readonly currentIndex: number;
};

export const clearHighlights = (container: HTMLElement): void => {
  container.querySelectorAll('mark.search-highlight').forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });
};

export const highlightMatches = (container: HTMLElement, query: string): ReadonlyArray<Element> => {
  clearHighlights(container);
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const marks: Element[] = [];

  // Process nodes in reverse so DOM mutations don't shift indices of earlier nodes
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i];
    if (!textNode) continue;
    const text = textNode.textContent || '';
    const lowerText = text.toLowerCase();
    const parent = textNode.parentNode;
    if (!parent || parent.nodeName === 'MARK') continue;

    // Find all match positions in this text node
    const positions: number[] = [];
    let searchFrom = 0;
    while (searchFrom <= lowerText.length - lowerQuery.length) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;
      positions.push(idx);
      searchFrom = idx + lowerQuery.length;
    }

    if (positions.length === 0) continue;

    // Build fragment by splitting text at match boundaries
    const frag = document.createDocumentFragment();
    let lastEnd = 0;

    for (const pos of positions) {
      if (pos > lastEnd) {
        frag.appendChild(document.createTextNode(text.slice(lastEnd, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(pos, pos + query.length);
      frag.appendChild(mark);
      lastEnd = pos + query.length;
    }

    if (lastEnd < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    parent.replaceChild(frag, textNode);
  }

  // Collect marks in document order after all mutations
  container.querySelectorAll('mark.search-highlight').forEach((m) => marks.push(m));
  return marks;
};

const scrollToMatch = (container: HTMLElement, matches: ReadonlyArray<Element>, index: number): void => {
  matches.forEach((m, i) => {
    if (i === index) {
      m.classList.add('search-highlight-active');
    } else {
      m.classList.remove('search-highlight-active');
    }
  });

  const target = matches[index];
  if (target) {
    target.scrollIntoView({ block: 'center' });
  }
};

export const useSearch = (containerRef: React.RefObject<HTMLElement | null>) => {
  const [state, setState] = useState<SearchState>({
    isOpen: false,
    query: '',
    matches: [],
    currentIndex: 0,
  });

  const matchesRef = useRef<ReadonlyArray<Element>>([]);

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true, query: '', matches: [], currentIndex: 0 }));
  }, []);

  const close = useCallback(() => {
    const el = containerRef.current;
    if (el) clearHighlights(el);
    matchesRef.current = [];
    setState({ isOpen: false, query: '', matches: [], currentIndex: 0 });
  }, [containerRef]);

  const search = useCallback((query: string) => {
    const el = containerRef.current;
    if (!el) return;
    const matches = highlightMatches(el, query);
    matchesRef.current = matches;
    const currentIndex = 0;
    if (matches.length > 0) {
      scrollToMatch(el, matches, currentIndex);
    }
    setState((prev) => ({ ...prev, query, matches, currentIndex }));
  }, [containerRef]);

  const next = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    setState((prev) => {
      const nextIndex = (prev.currentIndex + 1) % prev.matches.length;
      scrollToMatch(el, matchesRef.current, nextIndex);
      return { ...prev, currentIndex: nextIndex };
    });
  }, [containerRef]);

  const prev = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    setState((prev) => {
      const prevIndex = (prev.currentIndex - 1 + prev.matches.length) % prev.matches.length;
      scrollToMatch(el, matchesRef.current, prevIndex);
      return { ...prev, currentIndex: prevIndex };
    });
  }, [containerRef]);

  return {
    isSearchOpen: state.isOpen,
    matchCount: state.matches.length,
    currentMatch: state.currentIndex,
    openSearch: open,
    closeSearch: close,
    search,
    nextMatch: next,
    prevMatch: prev,
  };
};
