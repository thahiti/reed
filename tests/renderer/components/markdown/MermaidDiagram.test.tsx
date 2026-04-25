import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from '../../../../src/renderer/components/markdown/MermaidDiagram';
import { ThemeModeProvider } from '../../../../src/renderer/contexts/ThemeModeContext';

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">ok</svg>' }),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

describe('MermaidDiagram', () => {
  beforeEach(() => {
    initializeMock.mockClear();
    renderMock.mockClear();
    renderMock.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">ok</svg>' });
  });

  it('should render mermaid diagram as SVG with light theme by default', async () => {
    render(<MermaidDiagram chart="graph TD; A-->B;" />);
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    });
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'default', startOnLoad: false }),
    );
  });

  it('should initialize with theme "dark" inside dark provider', async () => {
    render(
      <ThemeModeProvider mode="dark">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
  });

  it('should re-render when mode changes from light to dark', async () => {
    const { rerender } = render(
      <ThemeModeProvider mode="light">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
    });
    initializeMock.mockClear();
    renderMock.mockClear();

    rerender(
      <ThemeModeProvider mode="dark">
        <MermaidDiagram chart="graph TD; A-->B;" />
      </ThemeModeProvider>,
    );
    await waitFor(() => {
      expect(initializeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
    expect(renderMock).toHaveBeenCalled();
  });
});
