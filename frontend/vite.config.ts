import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules/**/*', 'tests/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
})
