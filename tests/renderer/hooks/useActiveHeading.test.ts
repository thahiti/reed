import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveHeading } from '../../../src/renderer/hooks/useActiveHeading';

type ObserverCallback = () => void;

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
  trigger() {
    this.callback();
  }
}

// eslint-disable-next-line functional/no-let
let instances: MockIntersectionObserver[] = [];

const makeRect = (top: number): DOMRect => ({
  top,
  bottom: top + 20,
  left: 0,
  right: 100,
  width: 100,
  height: 20,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const setRect = (id: string, top: number): void => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no element with id ${id}`);
  el.getBoundingClientRect = () => makeRect(top);
};

// jsdom default innerHeight = 768; threshold = 768 * 0.3 = 230.4

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
  setRect('alpha', 0);
  setRect('beta', 0);
  setRect('gamma', 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useActiveHeading', () => {
  it('returns null when no ids provided', () => {
    const { result } = renderHook(() => useActiveHeading([]));
    expect(result.current).toBeNull();
  });

  it('picks the last heading whose top is at or above the threshold', () => {
    setRect('alpha', -100);
    setRect('beta', 100);
    setRect('gamma', 500);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('beta');
  });

  it('falls back to the first heading when all headings are below the threshold', () => {
    setRect('alpha', 400);
    setRect('beta', 500);
    setRect('gamma', 600);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('alpha');
  });

  it('picks the last heading when scrolled past all of them', () => {
    setRect('alpha', -500);
    setRect('beta', -300);
    setRect('gamma', -100);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('gamma');
  });

  it('recomputes when the observer fires after a scroll change (gg-to-top case)', () => {
    setRect('alpha', -500);
    setRect('beta', 100);
    setRect('gamma', 500);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('beta');

    // Simulate gg: scrolled to top, all headings now pushed below the threshold
    setRect('alpha', 400);
    setRect('beta', 600);
    setRect('gamma', 800);
    act(() => {
      instances[0]?.trigger();
    });
    expect(result.current).toBe('alpha');
  });

  it('recreates the observer when headingIds change', () => {
    const { rerender } = renderHook(({ ids }) => useActiveHeading(ids), {
      initialProps: { ids: ['alpha', 'beta'] },
    });
    expect(instances).toHaveLength(1);
    rerender({ ids: ['beta', 'gamma'] });
    expect(instances).toHaveLength(2);
  });
});
