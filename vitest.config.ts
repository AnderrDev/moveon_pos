import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'src/**/*.test.ts',
      'apps/pos-angular/src/app/features/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'apps/pos-angular/src/app/features/**/domain/dtos/**/*.ts',
        'apps/pos-angular/src/app/features/**/domain/usecases/**/*.ts',
        'apps/pos-angular/src/app/features/**/domain/services/**/*.ts',
        'apps/pos-angular/src/app/features/**/presentation/forms/**/*.ts',
        'src/shared/cache/**/*.ts',
        'src/shared/lib/error-message.ts',
        'src/shared/lib/format.ts',
        'src/shared/lib/payment-methods.ts',
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
      '@angular-app': path.resolve(__dirname, './apps/pos-angular/src/app'),
    },
  },
})
