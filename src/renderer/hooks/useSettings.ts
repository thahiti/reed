import { useState, useEffect } from 'react';
import type { AppSettings } from '../../shared/types';

const defaultSettings: AppSettings = {
  scroll: {
    stepLines: 8,
    pageLines: 30,
  },
};

export const useSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    void window.api.invoke('settings:get').then(setSettings);
  }, []);

  return settings;
};
