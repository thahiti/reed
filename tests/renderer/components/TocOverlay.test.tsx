import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TocOverlay } from '../../../src/renderer/components/TocOverlay';
import type { TocHeading } from '../../../src/shared/types/toc';

const headings: readonly TocHeading[] = [
  { level: 2, id: 'intro', text: 'Intro' },
  { level: 3, id: 'setup', text: 'Setup' },
  { level: 2, id: 'usage', text: 'Usage' },
];

describe('TocOverlay', () => {
  it('renders nothing when headings array is empty', () => {
    const { container } = render(
      <TocOverlay headings={[]} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all headings as buttons', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Intro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usage' })).toBeInTheDocument();
  });

  it('marks active heading with aria-current', () => {
    render(
      <TocOverlay headings={headings} activeId="setup" position="right" onItemClick={() => {}} />,
    );
    const setup = screen.getByRole('button', { name: 'Setup' });
    expect(setup).toHaveAttribute('aria-current', 'location');
    const intro = screen.getByRole('button', { name: 'Intro' });
    expect(intro).not.toHaveAttribute('aria-current');
  });

  it('sets data-level on each button', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Intro' })).toHaveAttribute('data-level', '2');
    expect(screen.getByRole('button', { name: 'Setup' })).toHaveAttribute('data-level', '3');
  });

  it('calls onItemClick with id when button is clicked', () => {
    const onItemClick = vi.fn();
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={onItemClick} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
    expect(onItemClick).toHaveBeenCalledWith('usage');
  });

  it('applies position class to root aside', () => {
    const { container } = render(
      <TocOverlay headings={headings} activeId={null} position="left" onItemClick={() => {}} />,
    );
    expect(container.querySelector('aside.toc-overlay-left')).not.toBeNull();
  });

  it('provides aria-label on root', () => {
    render(
      <TocOverlay headings={headings} activeId={null} position="right" onItemClick={() => {}} />,
    );
    expect(screen.getByLabelText('Document outline')).toBeInTheDocument();
  });
});
