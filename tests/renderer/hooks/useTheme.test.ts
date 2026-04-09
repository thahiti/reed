import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../../src/renderer/hooks/useTheme';
import { lightTheme } from '../../../src/renderer/themes/light';
import { darkTheme } from '../../../src/renderer/themes/dark';
import { getBodyFontFamily, getCodeFontFamily, defaultBodyFontId, defaultCodeFontId } from '../../../src/shared/fonts';

const mockInvoke = vi.fn();
const mockOn = vi.fn(() => vi.fn());

Object.defineProperty(window, 'api', {
  value: { invoke: mockInvoke, on: mockOn },
  writable: true,
});

// Theme with default font settings applied (no AppSettings)
const withDefaultFonts = <T extends { fonts: object }>(theme: T): T => ({
  ...theme,
  fonts: {
    ...theme.fonts,
    body: getBodyFontFamily(defaultBodyFontId),
    code: getCodeFontFamily(defaultCodeFontId),
  },
});

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'settings:get') return Promise.resolve(null);
      return Promise.resolve('light');
    });
  });

  it('should return light theme by default', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toEqual(lightTheme);
  });

  it('should apply default font settings to theme', async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.theme).toEqual(withDefaultFonts(lightTheme));
  });

  it('should return dark theme when system is dark', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'settings:get') return Promise.resolve(null);
      return Promise.resolve('dark');
    });
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.theme).toEqual(withDefaultFonts(darkTheme));
  });
});
