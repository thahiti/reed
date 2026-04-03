import { useState, useCallback } from 'react';
import type { Tab } from '../../shared/types';

let nextId = 0;
const generateId = (): string => `tab-${String(++nextId)}`;

export const useTabs = () => {
  const [tabs, setTabs] = useState<ReadonlyArray<Tab>>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((filePath: string, fileName: string, content: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: Tab = { id: generateId(), filePath, fileName, content };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);

      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        if (next.length === 0) return null;
        const newIndex = Math.min(index, next.length - 1);
        return next[newIndex]?.id ?? null;
      });

      return next;
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  return { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab: setActiveTabId };
};
