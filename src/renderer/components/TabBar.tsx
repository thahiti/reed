import type { FC } from 'react';
import type { Tab } from '../../shared/types';

type TabBarProps = {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
};

export const TabBar: FC<TabBarProps> = ({ tabs, activeTabId, onSelect, onClose }) => (
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
  </div>
);
