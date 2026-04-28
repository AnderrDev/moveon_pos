import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/modules/**/application/dtos/**/*.ts',
        'src/modules/**/application/use-cases/**/*.ts',
        'src/modules/**/domain/services/**/*.ts',
        'src/modules/**/forms/**/*.ts',
        'src/modules/**/store/**/*.ts',
        'src/shared/lib/format.ts',
        'src/shared/lib/payment-methods.ts',
        'src/shared/forms/**/*.ts',
        'src/shared/result.ts',
        'src/shared/validations/**/*.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
