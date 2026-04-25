import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationContext } from '../../../../src/renderer/contexts/NavigationContext';
import { Link } from '../../../../src/renderer/components/markdown/Link';

const mockInvoke = vi.fn();

const renderWithNav = (
  href: string,
  text: string,
  flashTargetHref: string | null = null,
  onNavigate: (h: string) => void = vi.fn(),
) =>
  render(
    <NavigationContext.Provider value={{ onNavigate, flashTargetHref }}>
      <Link href={href}>{text}</Link>
    </NavigationContext.Provider>,
  );

describe('Link', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: { invoke: mockInvoke, on: vi.fn() },
      writable: true,
      configurable: true,
    });
    mockInvoke.mockReset();
  });

  it('renders link text', () => {
    renderWithNav('https://example.com', 'Example');
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('calls file:open-external for external URLs and does not call onNavigate', () => {
    const onNavigate = vi.fn();
    renderWithNav('https://example.com', 'Example', null, onNavigate);
    fireEvent.click(screen.getByText('Example'));
    expect(mockInvoke).toHaveBeenCalledWith('file:open-external', 'https://example.com');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does nothing for in-page anchors (no preventDefault, no onNavigate)', () => {
    const onNavigate = vi.fn();
    renderWithNav('#section', 'Section', null, onNavigate);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('Section').dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate for relative .md links', () => {
    const onNavigate = vi.fn();
    renderWithNav('docs/foo.md', 'doc', null, onNavigate);
    fireEvent.click(screen.getByText('doc'));
    expect(onNavigate).toHaveBeenCalledWith('docs/foo.md');
  });

  it('calls onNavigate for relative .markdown links', () => {
    const onNavigate = vi.fn();
    renderWithNav('foo.markdown', 'mk', null, onNavigate);
    fireEvent.click(screen.getByText('mk'));
    expect(onNavigate).toHaveBeenCalledWith('foo.markdown');
  });

  it('calls onNavigate for .md with anchor (full href)', () => {
    const onNavigate = vi.fn();
    renderWithNav('docs/foo.md#intro', 'doc', null, onNavigate);
    fireEvent.click(screen.getByText('doc'));
    expect(onNavigate).toHaveBeenCalledWith('docs/foo.md#intro');
  });

  it('renders link-flash class when flashTargetHref matches href', () => {
    renderWithNav('docs/gone.md', 'gone', 'docs/gone.md');
    expect(screen.getByText('gone').className).toMatch(/link-flash/);
  });

  it('does not add link-flash class when flashTargetHref does not match', () => {
    renderWithNav('docs/gone.md', 'gone', 'docs/other.md');
    expect(screen.getByText('gone').className).not.toMatch(/link-flash/);
  });
});
