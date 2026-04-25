import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeProvider, useThemeMode } from '../../../src/renderer/contexts/ThemeModeContext';

const Probe = () => <span data-testid="mode">{useThemeMode()}</span>;

describe('ThemeModeContext', () => {
  it('should default to "light" without provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('should expose provider value', () => {
    render(
      <ThemeModeProvider mode="dark">
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });
});
