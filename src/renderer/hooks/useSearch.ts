import { useState, useCallback, useRef } from 'react';

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
    if (node instanceof Text) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

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
  return Array.from(container.querySelectorAll('mark.search-highlight'));
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

export type SearchPhase = 'idle' | 'inputting' | 'confirmed';

type SearchState = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matches: ReadonlyArray<Element>;
  readonly currentIndex: number;
  readonly savedScrollTop: number;
};

const initialState: SearchState = {
  phase: 'idle',
  query: '',
  matches: [],
  currentIndex: 0,
  savedScrollTop: 0,
};

export const useSearch = (containerRef: React.RefObject<HTMLElement | null>) => {
  const [state, setState] = useState(initialState);
  const matchesRef = useRef<ReadonlyArray<Element>>([]);
  const phaseRef = useRef<SearchPhase>('idle');
  const savedScrollTopRef = useRef(0);
  const queryRef = useRef('');
  const currentIndexRef = useRef(0);

  // Keep refs in sync so callbacks can read current values synchronously
  phaseRef.current = state.phase;
  queryRef.current = state.query;
  currentIndexRef.current = state.currentIndex;

  const openSearch = useCallback(() => {
    const el = containerRef.current;
    if (el) clearHighlights(el);
    matchesRef.current = [];
    const scrollTop = el?.scrollTop ?? 0;
    savedScrollTopRef.current = scrollTop;
    setState({
      ...initialState,
      phase: 'inputting',
      savedScrollTop: scrollTop,
    });
  }, [containerRef]);

  const closeSearch = useCallback(() => {
    const el = containerRef.current;
    if (el) clearHighlights(el);
    matchesRef.current = [];
    if (phaseRef.current === 'inputting' && el) {
      el.scrollTop = savedScrollTopRef.current;
    }
    // confirmed → idle: keep current scrollTop (don't restore)
    setState(initialState);
  }, [containerRef]);

  const confirmSearch = useCallback(() => {
    if (!queryRef.current.trim()) {
      // Empty query — go back to idle
      const el = containerRef.current;
      if (el) {
        clearHighlights(el);
        el.scrollTop = savedScrollTopRef.current;
      }
      matchesRef.current = [];
      setState(initialState);
      return;
    }
    setState((prev) => ({ ...prev, phase: 'confirmed' }));
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

  const nextMatch = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    const nextIndex = (currentIndexRef.current + 1) % matchesRef.current.length;
    scrollToMatch(el, matchesRef.current, nextIndex);
    currentIndexRef.current = nextIndex;
    setState((prev) => ({ ...prev, currentIndex: nextIndex }));
  }, [containerRef]);

  const prevMatch = useCallback(() => {
    const el = containerRef.current;
    if (!el || matchesRef.current.length === 0) return;
    const prevIndex = (currentIndexRef.current - 1 + matchesRef.current.length) % matchesRef.current.length;
    scrollToMatch(el, matchesRef.current, prevIndex);
    currentIndexRef.current = prevIndex;
    setState((prev) => ({ ...prev, currentIndex: prevIndex }));
  }, [containerRef]);

  return {
    phase: state.phase,
    query: state.query,
    matchCount: state.matches.length,
    currentIndex: state.currentIndex,
    openSearch,
    closeSearch,
    confirmSearch,
    search,
    nextMatch,
    prevMatch,
  };
};
