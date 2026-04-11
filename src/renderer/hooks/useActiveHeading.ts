import { useEffect, useState } from 'react';

const OBSERVATION_RATIO = 0.3;

const computeActiveHeading = (headingIds: readonly string[]): string | null => {
  if (headingIds.length === 0) return null;
  const threshold = window.innerHeight * OBSERVATION_RATIO;
  const active = headingIds.reduce<string | null>((acc, id) => {
    const el = document.getElementById(id);
    if (!el) return acc;
    return el.getBoundingClientRect().top <= threshold ? id : acc;
  }, null);
  return active ?? headingIds[0] ?? null;
};

export const useActiveHeading = (headingIds: readonly string[]): string | null => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    const update = (): void => {
      setActiveId(computeActiveHeading(headingIds));
    };
    update();

    const observer = new IntersectionObserver(update, {
      rootMargin: `0px 0px -${String((1 - OBSERVATION_RATIO) * 100)}% 0px`,
      threshold: 0,
    });

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
