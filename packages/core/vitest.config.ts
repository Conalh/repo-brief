import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run the suite's own *.test.ts; fixtures are sample data, not tests.
    include: ['src/**/*.test.ts'],
    exclude: ['fixtures/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
      reporter: ['text-summary'],
    },
  },
});
