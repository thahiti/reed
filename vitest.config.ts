import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          include: ['tests/main/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'renderer',
          include: ['tests/renderer/**/*.test.{ts,tsx}', 'tests/shared/**/*.test.ts', 'tests/smoke.test.ts'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
});
