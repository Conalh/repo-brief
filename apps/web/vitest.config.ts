import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // node:sqlite is a recent Node builtin Vite doesn't yet know; keep it
    // external so it loads natively instead of being bundled.
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
  },
});
