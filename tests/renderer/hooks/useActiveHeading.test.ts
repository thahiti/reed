import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveHeading } from '../../../src/renderer/hooks/useActiveHeading';

type ObserverCallback = (
  entries: ReadonlyArray<{ readonly target: Element; readonly isIntersecting: boolean }>,
) => void;

class MockIntersectionObserver {
  readonly callback: ObserverCallback;
  // eslint-disable-next-line functional/prefer-readonly-type
  observed: Element[] = [];
  constructor(cb: ObserverCallback) {
    this.callback = cb;
  }
  observe(el: Element) {
    this.observed = [...this.observed, el];
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((o) => o !== el);
  }
  disconnect() {
    this.observed = [];
  }
  fire(entries: ReadonlyArray<{ readonly id: string; readonly isIntersecting: boolean }>) {
    this.callback(
      entries.map((e) => {
        const target = document.getElementById(e.id);
        if (!target) throw new Error(`no element with id ${e.id}`);
        return { target, isIntersecting: e.isIntersecting };
      }),
    );
  }
}

// eslint-disable-next-line functional/no-let
let instances: MockIntersectionObserver[] = [];

beforeEach(() => {
  instances = [];
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: ObserverCallback) => {
      const obs = new MockIntersectionObserver(cb);
      instances = [...instances, obs];
      return obs;
    }),
  );
  document.body.innerHTML = `
    <h2 id="alpha">Alpha</h2>
    <h2 id="beta">Beta</h2>
    <h2 id="gamma">Gamma</h2>
  `;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useActiveHeading', () => {
  it('returns the first heading id immediately when headings are provided', () => {
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('alpha');
  });

  it('falls back to first heading when observer reports no intersecting entries', () => {
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    act(() => {
      instances[0]?.fire([
        { id: 'alpha', isIntersecting: false },
        { id: 'beta', isIntersecting: false },
        { id: 'gamma', isIntersecting: false },
      ]);
    });
    expect(result.current).toBe('alpha');
  });

  it('resets to the first heading when headingIds change', () => {
    const { result, rerender } = renderHook(({ ids }) => useActiveHeading(ids), {
      initialProps: { ids: ['alpha', 'beta'] },
    });
    expect(result.current).toBe('alpha');
    rerender({ ids: ['beta', 'gamma'] });
    expect(result.current).toBe('beta');
  });

  it('returns the topmost intersecting id based on headingIds order', () => {
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    act(() => {
      instances[0]?.fire([
        { id: 'beta', isIntersecting: true },
        { id: 'gamma', isIntersecting: true },
      ]);
    });
    expect(result.current).toBe('beta');
  });

  it('recreates the observer when headingIds change', () => {
    const { rerender } = renderHook(({ ids }) => useActiveHeading(ids), {
      initialProps: { ids: ['alpha', 'beta'] },
    });
    expect(instances).toHaveLength(1);
    rerender({ ids: ['beta', 'gamma'] });
    expect(instances).toHaveLength(2);
  });

  it('returns null when no ids provided', () => {
    const { result } = renderHook(() => useActiveHeading([]));
    expect(result.current).toBeNull();
  });
});
