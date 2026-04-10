import { useState, useEffect } from 'react';
import type { AppSettings } from '../../shared/types';
import {
  defaultTocSettings,
  type TocSettings,
  type TocHeadingLevel,
  type TocPosition,
} from '../../shared/types/toc';

const defaultSettings: AppSettings = {
  scroll: {
    stepLines: 8,
    pageLines: 30,
  },
  toc: defaultTocSettings,
};

const clampLevel = (value: unknown, fallback: TocHeadingLevel): TocHeadingLevel => {
  if (typeof value !== 'number') return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 6) return 6;
  return rounded as TocHeadingLevel;
};

const isPosition = (value: unknown): value is TocPosition =>
  value === 'left' || value === 'right';

export const sanitizeTocSettings = (
  input: Partial<TocSettings> | undefined,
): TocSettings => {
  const position: TocPosition = isPosition(input?.position)
    ? input.position
    : defaultTocSettings.position;
  const rawMin = clampLevel(input?.minLevel, defaultTocSettings.minLevel);
  const rawMax = clampLevel(input?.maxLevel, defaultTocSettings.maxLevel);
  const [minLevel, maxLevel] = rawMin > rawMax ? [rawMax, rawMin] : [rawMin, rawMax];
  const visible = typeof input?.visible === 'boolean' ? input.visible : false;
  return { position, minLevel, maxLevel, visible };
};

export const useSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    void window.api.invoke('settings:get').then((stored) => {
      setSettings({
        ...stored,
        toc: sanitizeTocSettings(stored.toc),
      });
    });
  }, []);

  return settings;
};
