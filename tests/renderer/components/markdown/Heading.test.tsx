import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading } from '../../../../src/renderer/components/markdown/Heading';

describe('Heading', () => {
  it('should render h1 with correct class', () => {
    render(<Heading level={1}>Title</Heading>);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Title');
    expect(heading).toHaveClass('heading', 'heading-1');
  });

  it('should render h3', () => {
    render(<Heading level={3}>Subtitle</Heading>);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Subtitle');
  });

  it('should generate anchor id from text content', () => {
    render(<Heading level={2}>Hello World</Heading>);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'hello-world');
  });
});
