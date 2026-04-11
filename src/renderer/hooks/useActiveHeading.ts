import { useEffect, useState } from 'react';

export const useActiveHeading = (headingIds: readonly string[]): string | null => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    setActiveId((prev) => (prev !== null && headingIds.includes(prev) ? prev : headingIds[0] ?? null));

    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingIds = new Set(
          entries.filter((e) => e.isIntersecting).map((e) => e.target.id),
        );
        const firstVisible = headingIds.find((id) => intersectingIds.has(id));
        if (firstVisible !== undefined) setActiveId(firstVisible);
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
