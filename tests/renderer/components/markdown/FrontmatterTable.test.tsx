import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrontmatterTable } from '../../../../src/renderer/components/markdown/FrontmatterTable';

describe('FrontmatterTable', () => {
  it('should render key-value pairs as table rows', () => {
    const data = JSON.stringify({ title: 'Hello', author: 'Randy' });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('author')).toBeDefined();
    expect(screen.getByText('Randy')).toBeDefined();
  });

  it('should render array values as badge pills', () => {
    const data = JSON.stringify({ tags: ['electron', 'react'] });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('electron')).toBeDefined();
    expect(screen.getByText('react')).toBeDefined();
  });

  it('should render nothing for empty data', () => {
    const { container } = render(<FrontmatterTable data="{}" />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing for invalid JSON', () => {
    const { container } = render(<FrontmatterTable data="invalid" />);
    expect(container.innerHTML).toBe('');
  });

  it('should render boolean and number values', () => {
    const data = JSON.stringify({ draft: true, version: 3 });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('true')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('should render nested object as JSON string', () => {
    const data = JSON.stringify({ meta: { key: 'value' } });
    render(<FrontmatterTable data={data} />);
    expect(screen.getByText('{"key":"value"}')).toBeDefined();
  });
});
