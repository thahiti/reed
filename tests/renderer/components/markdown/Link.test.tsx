import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Link } from '../../../../src/renderer/components/markdown/Link';

const mockInvoke = vi.fn();

describe('Link', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: { invoke: mockInvoke, on: vi.fn() },
      writable: true,
    });
    mockInvoke.mockReset();
  });

  it('should render link text', () => {
    render(<Link href="https://example.com">Example</Link>);
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('should call file:open-external for external URLs', () => {
    render(<Link href="https://example.com">Example</Link>);
    fireEvent.click(screen.getByText('Example'));
    expect(mockInvoke).toHaveBeenCalledWith('file:open-external', 'https://example.com');
  });

  it('should handle anchor links without calling IPC', () => {
    render(<Link href="#section">Section</Link>);
    const link = screen.getByText('Section');
    expect(link).toHaveAttribute('href', '#section');
  });
});
