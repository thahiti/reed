import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../../src/renderer/hooks/useTheme';
import { lightTheme } from '../../../src/renderer/themes/light';
import { darkTheme } from '../../../src/renderer/themes/dark';

const mockInvoke = vi.fn();
const mockOn = vi.fn(() => vi.fn());

Object.defineProperty(window, 'api', {
  value: { invoke: mockInvoke, on: mockOn },
  writable: true,
});

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue('light');
  });

  it('should return light theme by default', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toEqual(lightTheme);
  });

  it('should return dark theme when system is dark', async () => {
    mockInvoke.mockResolvedValue('dark');
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.theme).toEqual(darkTheme);
  });
});
