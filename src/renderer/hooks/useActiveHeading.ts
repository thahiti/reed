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

    // eslint-disable-next-line functional/no-let
    let rafId = 0;
    const scheduleUpdate = (): void => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };

    document.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      document.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [headingIds]);

  return activeId;
};
