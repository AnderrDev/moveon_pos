import { defineConfig } from 'vitest/config'
import path from 'path'

// Backtest del asesor de compras contra el seed masivo LOCAL
// (`pnpm seed:asesor`). No forma parte de `pnpm test`: `pnpm test:backtest`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/backtest/**/*.backtest.ts'],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@angular-app': path.resolve(__dirname, './apps/pos-angular/src/app'),
    },
  },
})
