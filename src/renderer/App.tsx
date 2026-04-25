import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useTabs, peekBack, peekForward } from './hooks/useTabs';
import { TabBar } from './components/TabBar';
import { MarkdownView } from './components/MarkdownView';
import { MarkdownEditor } from './components/MarkdownEditor';
import { Welcome } from './components/Welcome';
import { QuickOpen } from './components/QuickOpen';
import { useSettings } from './hooks/useSettings';
import { useMarkdown } from './hooks/useMarkdown';
import { useActiveHeading } from './hooks/useActiveHeading';
import { TocOverlay } from './components/TocOverlay';
import { defaultTocSettings } from '../shared/types/toc';
import { mergeKeybindings } from '../shared/keybindings';
import { matchAccelerator } from './matchAccelerator';
import { NavigationContext } from './contexts/NavigationContext';

export const App: FC = () => {
  const { theme, updateSettings } = useTheme();
  const settings = useSettings();
  const kb = mergeKeybindings(settings.keybindings);
  const isMac = navigator.userAgent.includes('Macintosh');
  const { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab, updateTabContent, markTabSaved, reloadTab, forceReloadTab, createNewTab, promoteTab, navigateTab, commitNavigateToIndex } = useTabs();
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tocVisible, setTocVisible] = useState(false);
  const [flashTargetHref, setFlashTargetHref] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topLineRef = useRef(1);

  const triggerFlash = useCallback((href: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashTargetHref(href);
    flashTimerRef.current = setTimeout(() => {
      setFlashTargetHref(null);
      flashTimerRef.current = null;
    }, 200);
  }, []);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);
  const tocInitializedRef = useRef(false);
  const { rendered: renderedMarkdown, headings: markdownHeadings } = useMarkdown(
    activeTab?.content ?? '',
    activeTab?.filePath ?? '',
  );
  const tocConfig = useMemo(
    () => ({ ...defaultTocSettings, ...(settings.toc ?? {}) }),
    [settings.toc],
  );
  const filteredHeadings = useMemo(
    () =>
      markdownHeadings.filter(
        (h) => h.level >= tocConfig.minLevel && h.level <= tocConfig.maxLevel,
      ),
    [markdownHeadings, tocConfig.minLevel, tocConfig.maxLevel],
  );
  const headingIds = useMemo(() => filteredHeadings.map((h) => h.id), [filteredHeadings]);
  const activeHeadingId = useActiveHeading(headingIds);

  const handleOpenFile = useCallback(async (filePath: string) => {
    const content = await window.api.invoke('file:read', filePath);
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1] ?? filePath;
    openTab(filePath, fileName, content);
    void window.api.invoke('file:watch', filePath);
    await window.api.invoke('history:add', filePath);
  }, [openTab]);

  const handleNavigate = useCallback((href: string) => {
    void (async () => {
      if (!activeTab || !activeTab.filePath) {
        triggerFlash(href);
        return;
      }
      if (activeTab.modified) {
        triggerFlash(href);
        return;
      }
      const hashIdx = href.indexOf('#');
      const relPath = hashIdx === -1 ? href : href.slice(0, hashIdx);
      const anchorId = hashIdx === -1 ? undefined : href.slice(hashIdx + 1);
      try {
        const absPath = await window.api.invoke('file:resolve-path', activeTab.filePath, relPath);
        const content = await window.api.invoke('file:read', absPath);
        const parts = absPath.split('/');
        const fileName = parts[parts.length - 1] ?? absPath;
        navigateTab(activeTab.id, { filePath: absPath, fileName, content, anchorId }, topLineRef.current);
        void window.api.invoke('file:watch', absPath);
        await window.api.invoke('history:add', absPath);
      } catch (err) {
        console.warn('[mdlink] navigation failed', href, err);
        triggerFlash(href);
      }
    })();
  }, [activeTab, navigateTab, triggerFlash]);

  const handleGoBack = useCallback(async () => {
    if (!activeTab || activeTab.modified) return;
    const target = peekBack(activeTab);
    if (!target) return;
    try {
      const content = await window.api.invoke('file:read', target.filePath);
      const parts = target.filePath.split('/');
      const fileName = parts[parts.length - 1] ?? target.filePath;
      commitNavigateToIndex(activeTab.id, activeTab.historyIndex - 1, content, fileName, topLineRef.current);
      void window.api.invoke('file:watch', target.filePath);
    } catch (err) {
      console.warn('[mdlink] goBack failed', target.filePath, err);
    }
  }, [activeTab, commitNavigateToIndex]);

  const handleGoForward = useCallback(async () => {
    if (!activeTab || activeTab.modified) return;
    const target = peekForward(activeTab);
    if (!target) return;
    try {
      const content = await window.api.invoke('file:read', target.filePath);
      const parts = target.filePath.split('/');
      const fileName = parts[parts.length - 1] ?? target.filePath;
      commitNavigateToIndex(activeTab.id, activeTab.historyIndex + 1, content, fileName, topLineRef.current);
      void window.api.invoke('file:watch', target.filePath);
    } catch (err) {
      console.warn('[mdlink] goForward failed', target.filePath, err);
    }
  }, [activeTab, commitNavigateToIndex]);

  const handleFileOpenDialog = useCallback(async () => {
    const filePath = await window.api.invoke('file:open-dialog');
    if (filePath) {
      await handleOpenFile(filePath);
    }
  }, [handleOpenFile]);

  const handleNewTab = useCallback(() => {
    createNewTab();
    setIsEditMode(true);
  }, [createNewTab]);

  const handleSaveAs = useCallback(async () => {
    if (!activeTab) return;
    const filePath = await window.api.invoke('file:save-dialog');
    if (!filePath) return;
    await window.api.invoke('file:write', filePath, activeTab.content);
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1] ?? filePath;
    promoteTab(activeTab.id, filePath, fileName);
    void window.api.invoke('file:watch', filePath);
    await window.api.invoke('history:add', filePath);
  }, [activeTab, promoteTab]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.filePath === null) {
      await handleSaveAs();
      return;
    }
    await window.api.invoke('file:write', activeTab.filePath, activeTab.content);
    markTabSaved(activeTab.id);
  }, [activeTab, markTabSaved, handleSaveAs]);

  const handleEditorChange = useCallback((content: string) => {
    if (activeTab) {
      updateTabContent(activeTab.id, content);
    }
  }, [activeTab, updateTabContent]);

  const handleCloseTab = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Untitled tab with content — confirm close
    if (tab.filePath === null && tab.content !== '') {
      const response = await window.api.invoke('dialog:confirm-close', '저장하지 않은 내용이 있습니다. 저장하시겠습니까?');
      if (response === 2) return; // Cancel
      if (response === 0) { // Save
        const savePath = await window.api.invoke('file:save-dialog');
        if (!savePath) return;
        await window.api.invoke('file:write', savePath, tab.content);
      }
      // response === 1: Don't save — fall through to close
    }

    // Unwatch file if it's the last tab with that filePath
    if (tab.filePath !== null) {
      const otherWithSameFile = tabs.filter((t) => t.id !== tabId && t.filePath === tab.filePath);
      if (otherWithSameFile.length === 0) {
        void window.api.invoke('file:unwatch', tab.filePath);
      }
    }

    closeTab(tabId);
  }, [tabs, closeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // New tab
      if (matchAccelerator(e, kb['file:new'], isMac)) {
        e.preventDefault();
        handleNewTab();
      }
      // Open file
      if (matchAccelerator(e, kb['file:open'], isMac)) {
        e.preventDefault();
        void handleFileOpenDialog();
      }
      // Quick Open
      if (matchAccelerator(e, kb['file:quick-open'], isMac)) {
        e.preventDefault();
        setIsQuickOpenOpen(true);
      }
      // Save
      if (matchAccelerator(e, kb['file:save'], isMac)) {
        e.preventDefault();
        void handleSave();
      }
      // Toggle edit mode (only when no input focused)
      if (matchAccelerator(e, kb['view:toggle-edit'], isMac)) {
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.classList.contains('cm-content');
        if (!isInputFocused) {
          e.preventDefault();
          setIsEditMode((prev) => !prev);
        }
      }
      // Copy file path (no input focused)
      if (matchAccelerator(e, kb['file:copy-path'], isMac)) {
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.classList.contains('cm-content');
        if (!isInputFocused && activeTab?.filePath) {
          e.preventDefault();
          void navigator.clipboard.writeText(activeTab.filePath);
        }
      }
      // Toggle TOC overlay (read mode only, no input focused)
      if (matchAccelerator(e, kb['view:toggle-toc'], isMac)) {
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.classList.contains('cm-content');
        if (!isInputFocused && !isEditMode) {
          e.preventDefault();
          setTocVisible((prev) => !prev);
        }
      }
      // Escape — Exit edit mode
      if (e.key === 'Escape' && isEditMode) {
        setIsEditMode(false);
      }
      // Cmd+1~9 — Switch tab (not configurable)
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        const tab = tabs[index];
        if (tab) setActiveTab(tab.id);
      }
      // Cmd+Shift+[ — Previous tab (legacy)
      if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevTab = tabs[currentIndex - 1];
        if (prevTab) setActiveTab(prevTab.id);
      }
      // Cmd+Shift+] — Next tab (legacy)
      if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextTab = tabs[currentIndex + 1];
        if (nextTab) setActiveTab(nextTab.id);
      }
      // Configurable tab:prev
      if (matchAccelerator(e, kb['tab:prev'], isMac)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevTab = tabs[currentIndex - 1];
        if (prevTab) setActiveTab(prevTab.id);
      }
      // Configurable tab:next
      if (matchAccelerator(e, kb['tab:next'], isMac)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextTab = tabs[currentIndex + 1];
        if (nextTab) setActiveTab(nextTab.id);
      }
      if (matchAccelerator(e, kb['nav:back'], isMac)) {
        e.preventDefault();
        void handleGoBack();
      }
      if (matchAccelerator(e, kb['nav:forward'], isMac)) {
        e.preventDefault();
        void handleGoForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [tabs, activeTabId, activeTab, setActiveTab, handleFileOpenDialog, handleSave, handleNewTab, isEditMode, kb, isMac, handleGoBack, handleGoForward]);

  // Drag & Drop
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      const mdFiles = files.filter((f) => f.name.endsWith('.md') || f.name.endsWith('.markdown'));
      mdFiles.forEach((file) => {
        const filePath = window.api.getPathForFile(file);
        if (filePath) {
          void handleOpenFile(filePath);
        }
      });
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };

    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [handleOpenFile]);

  // File Association — open-file event from main process
  useEffect(() => {
    const unsubscribe = window.api.on('app:open-file', (filePath: unknown) => {
      if (typeof filePath === 'string') {
        void handleOpenFile(filePath);
      }
    });
    return unsubscribe;
  }, [handleOpenFile]);

  // File watcher — reload content on external change
  useEffect(() => {
    const unsubscribe = window.api.on('file:changed', (filePath: unknown) => {
      if (typeof filePath !== 'string') return;
      const tab = tabs.find((t) => t.filePath === filePath);
      if (!tab) return;

      if (tab.modified) {
        void window.api.invoke('dialog:confirm-reload', tab.fileName).then((reload) => {
          if (!reload) return;
          void window.api.invoke('file:read', filePath).then((content) => {
            forceReloadTab(filePath, content);
          });
        });
      } else {
        void window.api.invoke('file:read', filePath).then((content) => {
          reloadTab(filePath, content);
        });
      }
    });
    return unsubscribe;
  }, [tabs, reloadTab, forceReloadTab]);

  // Help — render markdown help as a tab
  useEffect(() => {
    const unsubscribe = window.api.on('app:open-help', (content: unknown) => {
      if (typeof content === 'string') {
        openTab('reed://help', 'Help', content);
        setIsEditMode(false);
      }
    });
    return unsubscribe;
  }, [openTab]);

  // Menu — tab navigation
  useEffect(() => {
    const unsubPrev = window.api.on('menu:prev-tab', () => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      const prevTab = tabs[currentIndex - 1];
      if (prevTab) setActiveTab(prevTab.id);
    });
    const unsubNext = window.api.on('menu:next-tab', () => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      const nextTab = tabs[currentIndex + 1];
      if (nextTab) setActiveTab(nextTab.id);
    });
    return () => { unsubPrev(); unsubNext(); };
  }, [tabs, activeTabId, setActiveTab]);

  // Menu — close tab
  useEffect(() => {
    const unsub = window.api.on('menu:close-tab', () => {
      if (activeTab) void handleCloseTab(activeTab.id);
    });
    return unsub;
  }, [activeTab, handleCloseTab]);

  // Menu — new file
  useEffect(() => {
    const unsub = window.api.on('menu:new-file', () => {
      handleNewTab();
    });
    return unsub;
  }, [handleNewTab]);

  // Menu — save
  useEffect(() => {
    const unsub = window.api.on('menu:save', () => {
      void handleSave();
    });
    return unsub;
  }, [handleSave]);

  // Menu — copy file path
  useEffect(() => {
    const unsub = window.api.on('menu:copy-file-path', () => {
      if (activeTab?.filePath) {
        void navigator.clipboard.writeText(activeTab.filePath);
      }
    });
    return unsub;
  }, [activeTab]);

  // Menu — set body font
  useEffect(() => {
    const unsub = window.api.on('menu:set-body-font', (fontId: unknown) => {
      if (typeof fontId !== 'string') return;
      void window.api.invoke('settings:get').then((current) => {
        const updated = { ...current, bodyFont: fontId };
        void window.api.invoke('settings:set', updated).then(() => {
          updateSettings(updated);
        });
      });
    });
    return unsub;
  }, [updateSettings]);

  // Menu — set code font
  useEffect(() => {
    const unsub = window.api.on('menu:set-code-font', (fontId: unknown) => {
      if (typeof fontId !== 'string') return;
      void window.api.invoke('settings:get').then((current) => {
        const updated = { ...current, codeFont: fontId };
        void window.api.invoke('settings:set', updated).then(() => {
          updateSettings(updated);
        });
      });
    });
    return unsub;
  }, [updateSettings]);

  // Menu — toggle TOC (ignored in edit mode)
  useEffect(() => {
    const unsub = window.api.on('menu:toggle-toc', () => {
      if (!isEditMode) setTocVisible((prev) => !prev);
    });
    return unsub;
  }, [isEditMode]);

  // Initialize TOC visibility from settings (one-shot after first load)
  useEffect(() => {
    if (tocInitializedRef.current) return;
    if (settings.toc !== undefined) {
      tocInitializedRef.current = true;
      setTocVisible(Boolean(settings.toc.visible));
    }
  }, [settings.toc]);

  const handleTocItemClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLElement)) return;
    const container = el.closest('.markdown-view');
    if (!(container instanceof HTMLElement)) return;
    // Direct scrollTop assignment (no smooth) — a smooth animation races with
    // MarkdownView's useEffect([initialLine]) that resnaps scroll when the
    // parent re-renders mid-flight (IntersectionObserver → activeHeadingId).
    container.scrollTop = el.offsetTop;
  }, []);

  const isDark = theme.name === 'dark';
  const tocActive = Boolean(activeTab) && !isEditMode && tocVisible && filteredHeadings.length > 0;
  const mainClassName = tocActive
    ? `app-content toc-active-${tocConfig.position}`
    : 'app-content';

  return (
    <div className="app">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTab}
        onClose={(id) => { void handleCloseTab(id); }}
        onNewTab={handleNewTab}
      />
      <main className={mainClassName}>
        {activeTab ? (
          isEditMode ? (
            <MarkdownEditor
              content={activeTab.content}
              isDark={isDark}
              initialLine={topLineRef.current}
              onChange={handleEditorChange}
              onSave={() => { void handleSave(); }}
              onTopLineChange={(line) => { topLineRef.current = line; }}
            />
          ) : (
            <NavigationContext.Provider value={{ onNavigate: handleNavigate, flashTargetHref }}>
              <MarkdownView
                rendered={renderedMarkdown}
                initialLine={topLineRef.current}
                scrollSettings={settings.scroll}
                onTopLineChange={(line) => { topLineRef.current = line; }}
              />
            </NavigationContext.Provider>
          )
        ) : (
          <Welcome />
        )}
        {activeTab && !isEditMode && tocVisible && (
          <TocOverlay
            headings={filteredHeadings}
            activeId={activeHeadingId}
            position={tocConfig.position}
            onItemClick={handleTocItemClick}
          />
        )}
      </main>
      {activeTab && (
        <div className="mode-indicator">
          <span className={`mode-indicator-dot ${isEditMode ? 'mode-indicator-dot-edit' : 'mode-indicator-dot-read'}`} />
          {isEditMode ? 'Edit' : 'Read'}
          {activeTab.modified && <span className="mode-indicator-modified">●</span>}
        </div>
      )}
      <QuickOpen
        isOpen={isQuickOpenOpen}
        onClose={() => { setIsQuickOpenOpen(false); }}
        onSelect={(filePath) => { void handleOpenFile(filePath); }}
      />
    </div>
  );
};
