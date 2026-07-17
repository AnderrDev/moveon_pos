// @ts-check
const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const angular = require('angular-eslint')

// ── Fronteras de Clean Architecture feature-first (ADR 0015 §6.6, PLAN-63) ──
// Estas reglas hacen cumplir la arquitectura por herramienta, no por
// disciplina: violar una frontera rompe `pnpm lint`, no depende de que
// alguien lo recuerde en review.

const FEATURES = [
  'audit', 'auth', 'cash-register', 'customers', 'expenses', 'inventory',
  'loyalty', 'pos', 'products', 'reports', 'sales', 'settings',
]

const FEATURES_ROOT = 'apps/pos-angular/src/app/features'

/**
 * Excepciones documentadas: reutilización real de presentation/ entre
 * features, detectada al activar esta regla (2026-07-17). No son errores —
 * son deuda arquitectónica ya existente que PLAN-68 debe resolver
 * extrayendo la lógica compartida a domain/ o a un servicio propio, en vez
 * de que una feature reimporte el `presentation/services` de otra.
 */
const CROSS_FEATURE_PRESENTATION_EXCEPTIONS = [
  // cash-register reusa el export de "ventas del turno" que vive en pos/
  // (ambas pantallas describen el mismo turno; no hay owner claro todavía).
  `${FEATURES_ROOT}/cash-register/presentation/pages/caja.page.ts`,
  // configuracion.page.ts usa el datasource de impresión QZ de pos/ para el
  // botón "Imprimir prueba". La impresión es una capacidad transversal
  // (POS, caja, configuración) mal ubicada dentro de la feature pos/ —
  // candidata a moverse a core/ o a una feature "printing" propia.
  `${FEATURES_ROOT}/settings/presentation/pages/configuracion.page.ts`,
  // finanzas.page.ts reusa ReportsService.getDailyReport() para el resumen
  // financiero en vez de que ambas features consuman un use-case de
  // dominio compartido.
  `${FEATURES_ROOT}/expenses/presentation/pages/finanzas.page.ts`,
  // pos-data.service.ts reusa el ProductsCacheStore (signals) de products/
  // para no repetir el fetch del catálogo. Cache transversal mal ubicada
  // dentro de products/ — candidata a moverse a core/ o shared/.
  `${FEATURES_ROOT}/pos/presentation/services/pos-data.service.ts`,
]

const CROSS_FEATURE_MESSAGE =
  'Solo se puede importar domain/, data/repositories/ o presentation/dialogs|components de otra feature (ADR 0015 §3/§6.6). Si necesitas más, esa lógica probablemente debería vivir en domain/ (compartible) en vez de en presentation/ de otra feature.'

const crossFeatureGroup = (feature) =>
  FEATURES.filter((f) => f !== feature).flatMap((f) => [
    `@angular-app/features/${f}/presentation/pages/**`,
    `@angular-app/features/${f}/presentation/presenters/**`,
    `@angular-app/features/${f}/presentation/services/**`,
    `@angular-app/features/${f}/data/datasources/**`,
    `@angular-app/features/${f}/data/models/**`,
  ])

const DOMAIN_PURITY_PATTERNS = [
  {
    group: ['@angular/*', 'rxjs', 'rxjs/*', '@supabase/*', '@angular-app/core/*'],
    message: 'domain/ es TypeScript puro (ADR 0015 §6.6): no puede importar Angular, RxJS, Supabase ni core/.',
  },
  {
    group: ['**/data/**', '**/presentation/**'],
    message: 'domain/ no puede importar de data/ ni presentation/ — la dependencia va al revés (ADR 0015 §3).',
  },
]

const DATA_PURITY_PATTERN = {
  group: ['**/presentation/**'],
  message: 'data/ no puede importar de presentation/ (ADR 0015 §3).',
}

/**
 * IMPORTANTE: `no-restricted-imports` no se fusiona entre bloques de config
 * que matchean el mismo archivo — el último bloque cuyo `files` coincide
 * REEMPLAZA por completo las `patterns` del anterior (no las combina). Por
 * eso cada zona de abajo es UN solo bloque con la lista completa de
 * patrones para esa zona, en vez de bloques separados que se solapan.
 */
const boundaryConfigs = FEATURES.flatMap((feature) => [
  // Zona domain/ de esta feature: pureza + cero cross-feature indebido.
  {
    files: [`${FEATURES_ROOT}/${feature}/domain/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [...DOMAIN_PURITY_PATTERNS, { group: crossFeatureGroup(feature), message: CROSS_FEATURE_MESSAGE }],
      }],
    },
  },
  // Zona data/ de esta feature: no importa presentation/ propia + cero cross-feature indebido.
  {
    files: [`${FEATURES_ROOT}/${feature}/data/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [DATA_PURITY_PATTERN, { group: crossFeatureGroup(feature), message: CROSS_FEATURE_MESSAGE }],
      }],
    },
  },
  // Resto de la feature (presentation/ + <feature>.providers.ts en la raíz): solo cross-feature.
  {
    files: [`${FEATURES_ROOT}/${feature}/**/*.ts`],
    ignores: [`${FEATURES_ROOT}/${feature}/domain/**`, `${FEATURES_ROOT}/${feature}/data/**`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: crossFeatureGroup(feature), message: CROSS_FEATURE_MESSAGE }],
      }],
    },
  },
])

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'mo', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'mo', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  ...boundaryConfigs,
  // Excepciones documentadas a la regla cross-feature (ver CROSS_FEATURE_PRESENTATION_EXCEPTIONS).
  {
    files: CROSS_FEATURE_PRESENTATION_EXCEPTIONS,
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'node_modules/**', 'supabase/**'],
  },
)
