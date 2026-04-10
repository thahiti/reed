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

  it('should extract text from inline code children', () => {
    render(
      <Heading level={2}>
        <code>foo</code> bar
      </Heading>,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'foo-bar');
  });

  it('should extract text from emphasis elements', () => {
    render(
      <Heading level={2}>
        <strong>Bold</strong> and <em>italic</em>
      </Heading>,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'bold-and-italic');
  });

  it('should extract text from a nested array of children', () => {
    render(<Heading level={3}>{['Hello ', <code key="c">world</code>]}</Heading>);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveAttribute('id', 'hello-world');
  });
});
