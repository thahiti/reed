import { useEffect, useRef, type FC } from 'react';
import type { TocHeading, TocPosition } from '../../shared/types/toc';
import './TocOverlay.css';

type Props = {
  readonly headings: readonly TocHeading[];
  readonly activeId: string | null;
  readonly position: TocPosition;
  readonly onItemClick: (id: string) => void;
};

export const TocOverlay: FC<Props> = ({ headings, activeId, position, onItemClick }) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active item visible within the TOC's own scroll container.
  // `block: 'nearest'` is a no-op when already in view, avoiding jitter.
  // The typeof check is for jsdom test env where scrollIntoView is undefined.
  useEffect(() => {
    const el = activeRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  if (headings.length === 0) return null;
  return (
    <aside
      className={`toc-overlay toc-overlay-${position}`}
      aria-label="Document outline"
    >
      {headings.map((h) => (
        <button
          key={h.id}
          ref={activeId === h.id ? activeRef : null}
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
