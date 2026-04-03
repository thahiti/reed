import { useState, useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { HistoryEntry } from '../../shared/types';

export const useQuickOpen = () => {
  const [entries, setEntries] = useState<ReadonlyArray<HistoryEntry>>([]);
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () => new Fuse([...entries], { keys: ['fileName', 'filePath'], threshold: 0.4 }),
    [entries],
  );

  const loadHistory = useCallback(async () => {
    const history = await window.api.invoke('history:get');
    setEntries(history);
  }, []);

  const filteredEntries = useMemo(() => {
    if (query.trim() === '') return entries;
    return fuse.search(query).map((r) => r.item);
  }, [query, entries, fuse]);

  return { entries, filteredEntries, query, setQuery, loadHistory };
};
