import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Electron app test surface — TypeScript only, anywhere under src/.
    include: ['src/**/*.test.{ts,tsx}'],
    // Defensive exclusions: electron has its own src/ tree so it should
    // never reach into out/, dist/, or node_modules — but make it explicit
    // so a future src-adjacent path can't accidentally drag tests in.
    exclude: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'build/**',
    ],
  },
})
