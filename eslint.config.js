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
 * Excepciones documentadas a las reglas de frontera de presentation/ (cross-
 * feature y/o "no inyectar la propia data/ concreta"). No son errores — son
 * deuda arquitectónica ya existente (o casos límite razonables) que PLAN-68
 * debe revisar. Cada una lleva la justificación inline.
 */
const PRESENTATION_BOUNDARY_EXCEPTIONS = [
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
  // product-image-field.component.ts inyecta el datasource de Storage
  // (ProductImageStorageService) directo en vez de pasar por un método del
  // ProductRepository. Es un datasource (no el repositorio de escritura que
  // PLAN-64 cableó), y solo lo consume este componente — candidato a
  // exponerse como método del repositorio o a moverse a core/ si más
  // features necesitan subir imágenes.
  `${FEATURES_ROOT}/products/presentation/components/product-image-field.component.ts`,
]

/**
 * Features ya cableadas (PLAN-64..67): NADIE (ni su propia presentation/ ni
 * otra feature) puede inyectar su implementación concreta de data/ — solo
 * la abstracción de domain/repositories/. Se activa feature por feature a
 * medida que se cablea (ADR 0015 §6.6 punto 4); el resto sigue permitiendo
 * inyectar la clase concreta cross-feature hasta que le toque su turno.
 */
const CABLED_FEATURES = ['customers', 'expenses', 'loyalty', 'products', 'reports', 'settings']

const OWN_DATA_MESSAGE =
  'No se puede inyectar la implementación concreta de data/ — inyecta la abstracción de domain/repositories/ (ADR 0015 §6.6, feature ya cableada).'

const CROSS_FEATURE_MESSAGE =
  'Solo se puede importar domain/, data/repositories/ o presentation/dialogs|components de otra feature (ADR 0015 §3/§6.6). Si necesitas más, esa lógica probablemente debería vivir en domain/ (compartible) en vez de en presentation/ de otra feature.'

const crossFeatureGroup = (feature) =>
  FEATURES.filter((f) => f !== feature).flatMap((f) => [
    `@angular-app/features/${f}/presentation/pages/**`,
    `@angular-app/features/${f}/presentation/presenters/**`,
    `@angular-app/features/${f}/presentation/services/**`,
    `@angular-app/features/${f}/data/datasources/**`,
    `@angular-app/features/${f}/data/models/**`,
    ...(CABLED_FEATURES.includes(f) ? [`@angular-app/features/${f}/data/repositories/**`] : []),
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
  // Zona presentation/ de esta feature: cross-feature + (si ya está cableada)
  // prohibido inyectar la propia data/ directo, solo la abstracción.
  {
    files: [`${FEATURES_ROOT}/${feature}/presentation/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: crossFeatureGroup(feature), message: CROSS_FEATURE_MESSAGE },
          ...(CABLED_FEATURES.includes(feature)
            ? [{ group: [`@angular-app/features/${feature}/data/**`], message: OWN_DATA_MESSAGE }]
            : []),
        ],
      }],
    },
  },
  // Raíz de la feature (ej. <feature>.providers.ts): solo cross-feature —
  // el composition root SÍ debe poder importar su propia data/ e implementarla.
  {
    files: [`${FEATURES_ROOT}/${feature}/*.ts`],
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
  // Excepciones documentadas a las reglas de frontera (ver PRESENTATION_BOUNDARY_EXCEPTIONS).
  {
    files: PRESENTATION_BOUNDARY_EXCEPTIONS,
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'node_modules/**', 'supabase/**'],
  },
)
