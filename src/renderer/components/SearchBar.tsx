import { type FC, useCallback, useEffect, useRef, useState } from 'react';

type SearchBarProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSearch: (query: string) => void;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly matchCount: number;
  readonly currentMatch: number;
};

export const SearchBar: FC<SearchBarProps> = ({
  isOpen, onClose, onSearch, onNext, onPrev, matchCount, currentMatch,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      onSearch('');
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    }
  }, [isOpen, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  }, [onClose, onNext, onPrev]);

  if (!isOpen) return null;

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-bar-input"
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="search-bar-count">
        {query ? `${String(currentMatch + 1)}/${String(matchCount)}` : ''}
      </span>
      <button className="search-bar-btn" onClick={onPrev} disabled={matchCount === 0}>▲</button>
      <button className="search-bar-btn" onClick={onNext} disabled={matchCount === 0}>▼</button>
      <button className="search-bar-btn" onClick={onClose}>✕</button>
    </div>
  );
};
