import type { FC } from 'react';
import type { Tab } from '../../shared/types';

type TabBarProps = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onNewTab: () => void;
};

export const TabBar: FC<TabBarProps> = ({ tabs, activeTabId, onSelect, onClose, onNewTab }) => (
  <div className="tab-bar">
    {tabs.map((tab) => (
      <div
        key={tab.id}
        className={`tab-item ${tab.id === activeTabId ? 'tab-active' : ''}`}
        onClick={() => { onSelect(tab.id); }}
      >
        <span className="tab-title">{tab.modified ? `● ${tab.fileName}` : tab.fileName}</span>
        <button
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        >
          ×
        </button>
      </div>
    ))}
    <button className="tab-new" onClick={onNewTab}>+</button>
  </div>
);
