import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeBlock } from '../../../../src/renderer/components/markdown/CodeBlock';

describe('CodeBlock', () => {
  it('should render code with language label', () => {
    render(<CodeBlock language="typescript">const x = 1;</CodeBlock>);
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('should render without language label when not specified', () => {
    render(<CodeBlock>plain code</CodeBlock>);
    expect(screen.getByText('plain code')).toBeInTheDocument();
  });
});
