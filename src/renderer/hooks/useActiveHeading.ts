import { useEffect, useState } from 'react';

/**
 * Tracks the currently "active" heading while scrolling.
 *
 * IntersectionObserver only reports elements whose intersection state changed,
 * so a running set is maintained instead of rebuilding from each callback
 * batch. When nothing is currently intersecting (scrolled past the last
 * heading) the hook falls back to the last heading whose top is above the
 * viewport — the most recently passed one. Without this fallback the
 * highlight would disappear at the end of the document.
 */
export const useActiveHeading = (headingIds: readonly string[]): string | null => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    const intersecting = new Set<string>();

    const pickActive = (): string | null => {
      const firstVisible = headingIds.find((id) => intersecting.has(id));
      if (firstVisible !== undefined) return firstVisible;
      const passed = headingIds.filter((id) => {
        const el = document.getElementById(id);
        if (el === null) return false;
        return el.getBoundingClientRect().top < 0;
      });
      return passed[passed.length - 1] ?? null;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            intersecting.add(id);
          } else {
            intersecting.delete(id);
          }
        });
        setActiveId(pickActive());
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    headingIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [headingIds]);

  return activeId;
};
