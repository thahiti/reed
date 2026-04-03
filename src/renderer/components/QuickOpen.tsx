import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import { useQuickOpen } from '../hooks/useQuickOpen';

type QuickOpenProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelect: (filePath: string) => void;
};

export const QuickOpen: FC<QuickOpenProps> = ({ isOpen, onClose, onSelect }) => {
  const { filteredEntries, query, setQuery, loadHistory } = useQuickOpen();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
      setQuery('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen, loadHistory, setQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredEntries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const entry = filteredEntries[selectedIndex];
        if (entry) {
          onSelect(entry.filePath);
          onClose();
        }
      }
    },
    [filteredEntries, selectedIndex, onSelect, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div
        className="quick-open"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <input
          ref={inputRef}
          className="quick-open-input"
          placeholder="파일명으로 검색..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-list">
          {filteredEntries.map((entry, index) => (
            <div
              key={entry.filePath}
              className={`quick-open-item ${index === selectedIndex ? 'quick-open-selected' : ''}`}
              onClick={() => {
                onSelect(entry.filePath);
                onClose();
              }}
            >
              <span className="quick-open-filename">{entry.fileName}</span>
              <span className="quick-open-filepath">{entry.filePath}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
