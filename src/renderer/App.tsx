import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useTabs } from './hooks/useTabs';
import { TabBar } from './components/TabBar';
import { MarkdownView } from './components/MarkdownView';
import { MarkdownEditor } from './components/MarkdownEditor';
import { Welcome } from './components/Welcome';
import { QuickOpen } from './components/QuickOpen';

export const App: FC = () => {
  const { theme } = useTheme();
  const { tabs, activeTabId, activeTab, openTab, closeTab, setActiveTab, updateTabContent, markTabSaved } = useTabs();
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const scrollRatioRef = useRef(0);

  const handleOpenFile = useCallback(async (filePath: string) => {
    const content = await window.api.invoke('file:read', filePath);
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1] ?? filePath;
    openTab(filePath, fileName, content);
    await window.api.invoke('history:add', filePath);
  }, [openTab]);

  const handleFileOpenDialog = useCallback(async () => {
    const filePath = await window.api.invoke('file:open-dialog');
    if (filePath) {
      await handleOpenFile(filePath);
    }
  }, [handleOpenFile]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    await window.api.invoke('file:write', activeTab.filePath, activeTab.content);
    markTabSaved(activeTab.id);
  }, [activeTab, markTabSaved]);

  const handleEditorChange = useCallback((content: string) => {
    if (activeTab) {
      updateTabContent(activeTab.id, content);
    }
  }, [activeTab, updateTabContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+O — Open file
      if (e.metaKey && e.key === 'o') {
        e.preventDefault();
        void handleFileOpenDialog();
      }
      // Cmd+P — Quick Open
      if (e.metaKey && e.key === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
      }
      // Cmd+S — Save
      if (e.metaKey && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
      // t — Toggle edit mode (only when not in edit mode or when no input focused)
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isInputFocused = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.classList.contains('cm-content');
        if (!isInputFocused) {
          e.preventDefault();
          setIsEditMode((prev) => !prev);
        }
      }
      // Escape — Exit edit mode
      if (e.key === 'Escape' && isEditMode) {
        setIsEditMode(false);
      }
      // Cmd+1~9 — Switch tab
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        const tab = tabs[index];
        if (tab) setActiveTab(tab.id);
      }
      // Cmd+Shift+[ — Previous tab
      if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevTab = tabs[currentIndex - 1];
        if (prevTab) setActiveTab(prevTab.id);
      }
      // Cmd+Shift+] — Next tab
      if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextTab = tabs[currentIndex + 1];
        if (nextTab) setActiveTab(nextTab.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [tabs, activeTabId, setActiveTab, handleFileOpenDialog, handleSave, isEditMode]);

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

  const isDark = theme.name === 'dark';

  return (
    <div className="app">
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTab}
          onClose={closeTab}
        />
      )}
      <main className="app-content">
        {activeTab ? (
          isEditMode ? (
            <MarkdownEditor
              content={activeTab.content}
              isDark={isDark}
              initialScrollRatio={scrollRatioRef.current}
              onChange={handleEditorChange}
              onSave={() => { void handleSave(); }}
              onScrollRatioChange={(r) => { scrollRatioRef.current = r; }}
            />
          ) : (
            <MarkdownView
              content={activeTab.content}
              initialScrollRatio={scrollRatioRef.current}
              onScrollRatioChange={(r) => { scrollRatioRef.current = r; }}
            />
          )
        ) : (
          <Welcome />
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
