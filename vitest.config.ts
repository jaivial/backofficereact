import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "three"],
    alias: {
      three: path.resolve(process.cwd(), "node_modules/three"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git', 'e2e/specs', 'e2e/**/*.spec.{ts,tsx}'],
  },
});
