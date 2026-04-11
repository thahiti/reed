import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveHeading } from '../../../src/renderer/hooks/useActiveHeading';

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

const fireScroll = (): void => {
  act(() => {
    document.dispatchEvent(new Event('scroll'));
  });
};

// jsdom default innerHeight = 768; threshold = 768 * 0.3 = 230.4

beforeEach(() => {
  // Run requestAnimationFrame callbacks synchronously so scroll-driven updates
  // flush within the test.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => { /* noop */ });
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

  it('recomputes on scroll when intersection state did not change (gg/G case)', () => {
    // Initial: nothing in zone → fallback to first
    setRect('alpha', 400);
    setRect('beta', 600);
    setRect('gamma', 800);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta', 'gamma']));
    expect(result.current).toBe('alpha');

    // Simulate G: scrollTop=max. All headings scrolled above viewport.
    // Still nothing "in zone" in the IntersectionObserver sense, but scroll
    // event must trigger recompute.
    setRect('alpha', -800);
    setRect('beta', -500);
    setRect('gamma', -100);
    fireScroll();
    expect(result.current).toBe('gamma');

    // Simulate gg: back to the top.
    setRect('alpha', 400);
    setRect('beta', 600);
    setRect('gamma', 800);
    fireScroll();
    expect(result.current).toBe('alpha');
  });

  it('updates when a nested scroll container scrolls (capture phase)', () => {
    document.body.innerHTML = `
      <div id="scroller">
        <h2 id="alpha">Alpha</h2>
        <h2 id="beta">Beta</h2>
      </div>
    `;
    setRect('alpha', 0);
    setRect('beta', 500);
    const { result } = renderHook(() => useActiveHeading(['alpha', 'beta']));
    expect(result.current).toBe('alpha');

    setRect('alpha', -600);
    setRect('beta', 100);
    act(() => {
      const scroller = document.getElementById('scroller');
      scroller?.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe('beta');
  });

  it('resets to the first heading when headingIds change', () => {
    setRect('alpha', 400);
    setRect('beta', 500);
    const { result, rerender } = renderHook(({ ids }) => useActiveHeading(ids), {
      initialProps: { ids: ['alpha', 'beta'] },
    });
    expect(result.current).toBe('alpha');
    rerender({ ids: ['beta'] });
    expect(result.current).toBe('beta');
  });
});
