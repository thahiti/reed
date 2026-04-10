import type { FC } from 'react';
import type { TocHeading, TocPosition } from '../../shared/types/toc';
import './TocOverlay.css';

type Props = {
  readonly headings: readonly TocHeading[];
  readonly activeId: string | null;
  readonly position: TocPosition;
  readonly onItemClick: (id: string) => void;
};

export const TocOverlay: FC<Props> = ({ headings, activeId, position, onItemClick }) => {
  if (headings.length === 0) return null;
  return (
    <aside
      className={`toc-overlay toc-overlay-${position}`}
      aria-label="Document outline"
    >
      {headings.map((h) => (
        <button
          key={h.id}
          type="button"
          data-level={String(h.level)}
          aria-current={activeId === h.id ? 'location' : undefined}
          onClick={() => {
            onItemClick(h.id);
          }}
        >
          {h.text}
        </button>
      ))}
    </aside>
  );
};
