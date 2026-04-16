import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import type { SearchPhase } from '../hooks/useSearch';

type SearchBarProps = {
  readonly phase: SearchPhase;
  readonly query: string;
  readonly matchCount: number;
  readonly currentIndex: number;
  readonly onSearch: (query: string) => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
};

const MatchCount: FC<{ readonly query: string; readonly matchCount: number; readonly currentIndex: number }> = ({
  query, matchCount, currentIndex,
}) => {
  if (!query) return null;
  return (
    <span className="search-bar-count">
      {matchCount === 0 ? 'No matches' : `${String(currentIndex + 1)}/${String(matchCount)}`}
    </span>
  );
};

export const SearchBar: FC<SearchBarProps> = ({
  phase, query, matchCount, currentIndex, onSearch, onConfirm, onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'inputting') {
      setInputValue('');
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    }
  }, [phase]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  }, [onClose, onConfirm]);

  if (phase === 'idle') return null;

  if (phase === 'confirmed') {
    return (
      <div className="search-bar search-bar-confirmed">
        <span className="search-bar-query">/{query}</span>
        <MatchCount query={query} matchCount={matchCount} currentIndex={currentIndex} />
      </div>
    );
  }

  // phase === 'inputting'
  return (
    <div className="search-bar search-bar-inputting">
      <span className="search-bar-prefix">/</span>
      <input
        ref={inputRef}
        className="search-bar-input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onSearch(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <MatchCount query={inputValue} matchCount={matchCount} currentIndex={currentIndex} />
    </div>
  );
};
