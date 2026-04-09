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
      const newTab: Tab = { id: generateId(), filePath, fileName, content, modified: false };
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

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content, modified: true } : t)),
    );
  }, []);

  const markTabSaved = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, modified: false } : t)),
    );
  }, []);

  const reloadTab = useCallback((filePath: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.filePath === filePath && !t.modified ? { ...t, content } : t,
      ),
    );
  }, []);

  const createNewTab = useCallback(() => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.filePath === null);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: Tab = { id: generateId(), filePath: null, fileName: 'Untitled', content: '', modified: false };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, []);

  const promoteTab = useCallback((tabId: string, filePath: string, fileName: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, filePath, fileName, modified: false } : t)),
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  return { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab: setActiveTabId, updateTabContent, markTabSaved, reloadTab, createNewTab, promoteTab };
};
