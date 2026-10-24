import { defineConfig } from 'vitest/config'
import path from 'path'

// Pruebas que necesitan el Supabase LOCAL corriendo (`supabase start`).
// No forman parte de `pnpm test`; se corren con `pnpm test:parity`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@angular-app': path.resolve(__dirname, './apps/pos-angular/src/app'),
    },
  },
})
