import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from '../../../../src/renderer/components/markdown/MermaidDiagram';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">mocked</svg>' }),
  },
}));

describe('MermaidDiagram', () => {
  it('should render mermaid diagram as SVG', async () => {
    render(<MermaidDiagram chart="graph TD; A-->B;" />);
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    });
  });
});
