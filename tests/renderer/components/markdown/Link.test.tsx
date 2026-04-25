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

  it('handles in-page anchors by calling scrollIntoView without onNavigate', () => {
    const onNavigate = vi.fn();
    const target = document.createElement('h2');
    target.id = 'section';
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    renderWithNav('#section', 'Section', null, onNavigate);
    fireEvent.click(screen.getByText('Section'));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(onNavigate).not.toHaveBeenCalled();

    document.body.removeChild(target);
  });

  it('decodes percent-encoded anchor (Korean) before getElementById lookup', () => {
    const onNavigate = vi.fn();
    const target = document.createElement('h2');
    target.id = '1-문서-개요';
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    // Simulates the percent-encoded href that micromark produces for Korean
    renderWithNav('#1-%EB%AC%B8%EC%84%9C-%EA%B0%9C%EC%9A%94', '문서 개요', null, onNavigate);
    fireEvent.click(screen.getByText('문서 개요'));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(onNavigate).not.toHaveBeenCalled();

    document.body.removeChild(target);
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
