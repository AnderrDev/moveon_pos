# 02 — Arquitectura

> Reglas no negociables. Cualquier desviación requiere un ADR.
> Arquitectura vigente: **Clean Architecture feature-first (ADR 0015)** + design system atómico (ADR 0014).

---

## 1. Stack tecnológico

| Capa             | Tecnología             | Versión / Notas                                   |
| ---------------- | ---------------------- | ------------------------------------------------- |
| Framework        | Angular                | 21+ standalone PWA (ver ADR 0006)                 |
| Lenguaje         | TypeScript             | Strict mode                                       |
| UI               | Angular                | Standalone components + signals                   |
| Estilos          | Tailwind CSS           | 4+                                                |
| Componentes      | Angular propios        | Design system atómico en `shared/` (ADR 0014)     |
| Base de datos    | PostgreSQL             | Vía Supabase                                      |
| Auth             | Supabase Auth          | Email + password                                  |
| Storage          | Supabase Storage       | Logos, PDFs, comprobantes                         |
| Edge Functions   | Supabase Functions     | Solo casos específicos (ver §6)                   |
| Realtime         | Supabase Realtime      | Opcional, no en MVP                               |
| Validación       | Zod                    | Todos los bordes                                  |
| Estado cliente   | Angular signals        | Stores `@Injectable` con `signal/computed`        |
| Data fetching    | Supabase JS            | RLS + RPC/Edge Functions para escrituras críticas |
| Forms            | Angular Reactive Forms | + Zod factory/mapper/presenter                    |
| Tests            | Vitest                 | Unitarios (dominio + DTOs + use-cases + forms)    |
| Tests E2E        | Playwright             | Solo flujos críticos                              |
| Linter           | ESLint + @angular-eslint | Cableado; hace cumplir las fronteras de arquitectura (§2.5) |
| Formatter        | Prettier               | Config estándar                                   |
| Package manager  | pnpm                   | Obligatorio (no npm/yarn)                         |
| Hosting frontend | Netlify                | Dos sitios: `pos-angular` (ADR 0009) y `landing-web` (ADR 0012), mismo repo |
| CI/CD            | GitHub Actions         | Deploy automático en main (re-cablear post-cleanup)|

**Justificación de elecciones clave:** ver ADRs en `/docs/adr/`.

---

## 2. Principios arquitectónicos

### 2.1 Clean Architecture feature-first (ADR 0015)

**Cada feature es autocontenida:** sus tres capas viven juntas dentro de la carpeta de la feature, en `apps/pos-angular/src/app/features/<feature>/`. No existe ningún dominio fuera de las features (la carpeta `src/modules/` del esquema anterior fue eliminada; ver nota histórica al final de §2.1).

```
apps/pos-angular/src/app/features/<feature>/
├── <feature>.providers.ts      # Composition root (§2.4): abstracción → implementación
├── domain/                     # QUÉ hace el negocio — TypeScript PURO
│   ├── entities/               #   Product, Sale, Cliente, CashSession…
│   ├── value-objects/          #   PhoneCO, Money…
│   ├── repositories/           #   CONTRATOS como abstract class (§2.3)
│   ├── services/               #   reglas puras: sale-calculator, stamps, nomina…
│   ├── usecases/               #   create-sale, transfer-stock, register-expense…
│   └── dtos/                   #   schemas Zod de borde (contratos de entrada/salida)
├── data/                       # CÓMO se obtienen/persisten los datos
│   ├── datasources/            #   acceso crudo a UN sistema externo
│   │                           #   (ej: Supabase Storage para imágenes de producto)
│   ├── models/                 #   row types de la DB + mappers fila ↔ entidad
│   └── repositories/           #   implementación @Injectable que extiende el contrato
└── presentation/               # CÓMO se muestra — Angular
    ├── pages/                  #   *.page.ts (rutas lazy)
    ├── dialogs/                #   *.dialog.ts
    ├── components/             #   *.component.ts propios de la feature
    ├── presenters/             #   *.presenter.ts (forms) + stores (signals)
    ├── forms/                  #   factory + mapper Zod (patrón 3 archivos, TS puro)
    └── services/               #   orquestación UI: exports Excel, error-mappers, helpers
```

**Las 12 features:** `audit` · `auth` · `cash-register` · `customers` · `expenses` · `inventory` · `loyalty` · `pos` · `products` · `reports` · `sales` · `settings`.

No toda feature tiene las tres capas completas (ej: `auth` y `pos` solo tienen `presentation/` — la sesión vive en `core/auth/`, la impresión QZ en `core/printing/`, y `pos` consume el dominio de `sales`). Lo que sí es invariable: cada archivo vive en la zona que le corresponde.

**Nota sobre `pos` vs `sales`:** `sales` es el bounded context (dominio de la venta: entidades, calculadora, repositorio); `pos` es la pantalla de venta (presentación pesada; la impresión que orquesta vive en `core/printing/`). `pos` consume el dominio de `features/sales` — es la única dependencia entre-features aceptada explícitamente.

**Regla de dependencias (no negociable):**

```
presentation ──→ domain ←── data
```

- **`domain/` no importa NADA de Angular, Supabase, RxJS, `core/` ni de `data/` o `presentation/`.** Es TypeScript puro y testeable con vitest sin mocks de framework.
- **`data/` implementa los contratos de `domain/repositories/`** y es el único lugar que conoce Supabase. Sus `models/` (rows + mappers) tampoco importan Angular.
- **`presentation/` depende solo de abstracciones de dominio** — nunca importa `data/` (eso lo hace el composition root). `presentation/forms/` es TS puro (schemas Zod) aunque viva en presentación: es el contrato del formulario.
- **Una feature no importa de otra feature**, salvo la excepción `pos → sales/domain`. Lo compartido de verdad se promueve a `src/shared/` o al design system.

**Las 4 zonas por feature** (así las vigila el linter, §2.5):

| Zona | Qué contiene | Puede importar |
|---|---|---|
| `domain/` | Entidades, VOs, contratos, servicios puros, use-cases, DTOs Zod | `src/shared/` y su propio `domain/` |
| `data/` | Datasources, models/mappers, repos implementación | `domain/` propio, Supabase, Angular DI, `core/` |
| `presentation/` | Pages, dialogs, components, presenters, forms, servicios UI | `domain/` propio (abstracciones), `shared/` (design system), `core/` |
| Raíz (`<feature>.providers.ts`) | Composition root | `domain/` Y `data/` propios — es el ÚNICO archivo que conoce ambos |

> **Nota histórica:** entre 2026-05 y 2026-07 el dominio vivió en `src/modules/<modulo>` separado de la feature Angular (híbrido del ADR 0014, y antes `application/`/`infrastructure/`). El ADR 0015 co-ubicó todo dentro de cada feature; `src/modules/` ya no existe. Referencias a esas rutas en ADRs viejos, auditorías y specs de sesión son historial y no se corrigen.

### 2.2 Patrón Adapter para integraciones externas

Cualquier integración con un sistema externo (proveedor de facturación, impresora, datáfono futuro) se implementa como adapter: contrato en `domain/`, implementación en `data/datasources|repositories`.

```typescript
// features/billing/domain/repositories/billing-provider.ts (futuro)
export abstract class BillingProvider {
  abstract issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>
  abstract voidDocument(documentId: string): Promise<Result<void, BillingError>>
  abstract getDocumentStatus(documentId: string): Promise<Result<BillingStatus, BillingError>>
}

// features/billing/data/repositories/factus.adapter.ts
export class FactusAdapter extends BillingProvider { /* ... */ }

// features/billing/data/repositories/mock.adapter.ts (tests y desarrollo)
export class MockBillingAdapter extends BillingProvider { /* ... */ }
```

Ejemplo real hoy: la impresión ESC/POS vía QZ Tray (ADR 0010) vive en `core/printing/` — es una capacidad transversal (POS, caja y configuración la usan), por eso no pertenece a una feature.

### 2.3 Contratos de dominio como `abstract class` (tokens de DI)

Las `interface` de TypeScript se borran en runtime → no sirven como token de inyección. Una **clase abstracta es TS puro** (cero imports de Angular) y sí existe en runtime, así que funciona directamente como token del inyector (ADR 0015 §6.1):

```typescript
// features/products/domain/repositories/product.repository.ts — TS PURO
export abstract class ProductRepository {
  abstract listProducts(params: SearchProductsParams): Promise<Product[]>
  abstract createProduct(dto: CreateProductDto, initialStock: InitialStockInput): Promise<Product>
  // ...
}

// features/products/data/repositories/products.repository.ts — Angular + Supabase
@Injectable()
export class ProductsRepository extends ProductRepository { /* ... */ }
```

La presentación inyecta la ABSTRACCIÓN — `inject(ProductRepository)` — nunca la clase Supabase. Ninguna page/dialog/presenter sabe que Supabase existe (Dependency Inversion, garantizado por el linter §2.5).

### 2.4 Use-cases y composition roots

**Use-case = función pura con deps como argumento** (sin clases `@Injectable` en dominio, sin factory-providers por use-case):

```typescript
// features/products/domain/usecases/create-product.use-case.ts — TS puro
export async function createProduct(
  deps: { repo: ProductRepository },
  input: CreateProductInput,
): Promise<Result<Product, CreateProductError>> {
  const parsed = createProductSchema.safeParse(input)   // Zod en el borde
  if (!parsed.success) return err({ code: 'validation', ... })
  // ...
  return ok(product)
}

// presentation/pages/productos.page.ts
private readonly repo = inject(ProductRepository)       // la abstracción
// ...
const result = await createProduct({ repo: this.repo }, dto)
```

Regla (ADR 0015 §6.3): **toda ESCRITURA pasa por un use-case** (valida con Zod, devuelve `Result<T, E>`); las **lecturas simples llaman al repositorio-abstracción directo** desde presentación — no se envuelven en use-cases triviales.

**Composition root por feature: `<feature>.providers.ts`** — el ÚNICO archivo que conoce dominio E implementación a la vez:

```typescript
// features/products/products.providers.ts
export const productsProviders: Provider[] = [
  { provide: ProductRepository, useClass: ProductsRepository },
]
```

Todos los `<feature>.providers.ts` se registran en **`app.config.ts` (root)**, no por ruta lazy: casi todos los repositorios se consumen desde múltiples rutas a la vez (ej. `InventoryRepository` desde `/pos`, `/inventario` y `/reportes`), y `withPreloading(PreloadAllModules)` ya precarga todas las rutas, así que escopar por ruta solo ocultaría providers a rutas hermanas sin ganar code-splitting (decisión PLAN-62, ADR 0015 §6.2).

### 2.5 Fronteras aplicadas por ESLint (no por disciplina)

`eslint.config.js` genera bloques `no-restricted-imports` por feature y por zona (ADR 0015 §6.6). Violar una frontera rompe `pnpm lint`:

1. `features/**/domain/**` no importa `@angular/*`, `@supabase/*`, `rxjs`, `@angular-app/core/*`, ni `../data` / `../presentation`.
2. `features/**/data/**` no importa `presentation/`.
3. Cross-feature: de otra feature solo se puede importar su `domain/` o sus `presentation/dialogs|components`; quedan bloqueados `presentation/pages|presenters|services`, `data/datasources|models` y — en features cableadas — `data/repositories`. La única dependencia entre-features aceptada como diseño es `pos → sales/domain`; si necesitas más, esa lógica probablemente debe vivir en `domain/` compartible o en `src/shared/`.
4. En features **cableadas** (lista `CABLED_FEATURES` en `eslint.config.js` — hoy las 12, todas), nadie puede inyectar la implementación concreta de `data/` — solo la abstracción de `domain/repositories/`.
5. Nada fuera de `shared/{atoms,molecules,organisms}` define componentes UI genéricos.

No quedan excepciones activas a estas fronteras (las 5 excepciones temporales de PLAN-63..67 se resolvieron en PLAN-68). Si alguna vez se necesita una, se declara inline en `eslint.config.js` con justificación — deuda anotada, nunca permiso tácito.

### 2.6 Errores tipados con Result

No usar `throw` para errores de negocio. Usar tipo `Result<T, E>` (`src/shared/result.ts`):

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

Solo `throw` para errores **técnicos** (DB caída, network failure). Errores de **dominio** (stock insuficiente, caja cerrada, descuento no autorizado) son `Result.error`.

### 2.7 Idempotencia

Operaciones críticas deben ser idempotentes:

- **Crear venta:** se acepta `idempotency_key` desde el cliente. Si llega duplicado, se devuelve la misma venta.
- **Emitir factura:** un `sale_id` solo se factura una vez. Reintentos no generan documentos duplicados.
- **Cerrar caja:** un `cash_session_id` solo se cierra una vez.

### 2.8 Multi-sede en datos

Toda tabla operativa incluye `tienda_id` con `NOT NULL` y FK a `tiendas`. RLS filtra automáticamente por la tienda del usuario actual.

---

## 3. Estructura de carpetas

```
moveonapp-pos/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── tsconfig.angular.json
├── angular.json
├── eslint.config.js               # incluye las fronteras de arquitectura (§2.5)
├── .postcssrc.json
├── .env.example
├── docs/                          # Documentación viva
│   ├── 00-vision.md
│   ├── 01-mvp-scope.md
│   ├── 02-architecture.md
│   ├── 03-data-model.md
│   ├── 04-roadmap.md
│   ├── 05-glossary.md
│   ├── adr/
│   ├── modules/
│   ├── standards/
│   ├── sessions/
│   └── user-stories/
├── src/                           # SOLO lo transversal (TS sin frameworks)
│   ├── shared/                    # Compartido entre features
│   │   ├── cache/                 # Cache TTL puro
│   │   ├── lib/                   # Helpers puros (format, payment-methods, error-message)
│   │   ├── types/                 # Tipos compartidos (TiendaId, InventoryLocation, …)
│   │   ├── result.ts              # Tipo Result<T, E>
│   │   └── validations/           # Schemas Zod compartidos
│   └── infrastructure/
│       └── supabase/
│           └── database.types.ts  # Tipos generados desde Supabase
├── apps/
│   ├── pos-angular/               # Angular 21 standalone PWA — TODA la app
│   │   └── src/
│   │       ├── environments/
│   │       ├── styles.css         # Tailwind v4 (@import + @theme)
│   │       ├── index.html
│   │       ├── main.ts
│   │       └── app/
│   │           ├── app.config.ts  # Composition root global (registra *.providers.ts)
│   │           ├── core/          # transversal: auth/sesión, cliente Supabase, config,
│   │           │                  # layout, tienda, printing (QZ), catalog (cache productos)
│   │           ├── features/      # 12 features autocontenidas (§2.1):
│   │           │   └── <feature>/{domain,data,presentation}/ + <feature>.providers.ts
│   │           └── shared/        # design system atómico: atoms/, molecules/, organisms/, services/
│   └── landing-web/               # Landing independiente (ADR 0012, fuera de este esquema)
├── supabase/
│   ├── migrations/                # SQL versionado
│   ├── functions/                 # Edge Functions
│   ├── seed.sql                   # Datos de prueba
│   └── config.toml
├── scripts/                       # Utilidades CLI locales (seed admin, import Siigo, session-start)
└── tests/
    ├── unit/                      # Espejo por feature: tests/unit/features/<feature>/
    │                              # (también hay *.test.ts co-ubicados junto al código puro)
    ├── integration/               # Tests de integración
    └── e2e/                       # Tests E2E (Playwright apuntando a localhost:4200)
```

**Aliases de imports:** `@/` → `src/` (solo `shared/` e `infrastructure/`) y `@angular-app/` → `apps/pos-angular/src/app/`. El dominio de una feature se importa como `@angular-app/features/<feature>/domain/...`.

---

## 4. Reglas de acceso a datos

### 4.1 Capas de acceso

```
Page / Dialog / Presenter  (features/<f>/presentation/)
    ↓  escrituras                          ↓  lecturas simples
Use case (features/<f>/domain/usecases/)   │
    ↓                                      │
Contrato abstract class (features/<f>/domain/repositories/)
    ↓  (resuelto por DI vía <feature>.providers.ts en app.config.ts)
Implementación @Injectable (features/<f>/data/repositories/, usa Supabase client o RPC)
    ↓
PostgreSQL (con RLS)
```

Las escrituras críticas no se hacen con múltiples inserts desde componentes Angular: deben ir a RPC transaccional o Edge Function. La sesión interactiva en el browser se autentica con `@supabase/supabase-js` usando la `SUPABASE_ANON_KEY` y respeta RLS.

### 4.2 Cliente Supabase en Angular

- Único cliente: `apps/pos-angular/src/app/core/supabase/supabase-client.service.ts` instancia un `SupabaseClient<Database>` con la anon key cargada desde `environments/environment.ts` (idealmente, archivo runtime cargado al bootstrap).
- No existe ningún cliente "server" — Server Components y Server Actions desaparecieron junto con Next.
- Si se necesita ejecutar lógica con `service_role`, va en una Edge Function de Supabase o un script CLI local en `scripts/`.

### 4.3 RPC vs Edge Functions

| Caso                                        | Usar                                  |
| ------------------------------------------- | ------------------------------------- |
| CRUD interno con auth de usuario y RLS      | `supabase.from(...)` con anon key     |
| Operaciones críticas atómicas (venta, anulación, cierre de caja) | RPC transaccional (`create_sale_atomic`, etc.) |
| Webhooks de proveedores externos            | Edge Function de Supabase             |
| Cron jobs (sincronizar billing status)      | Edge Function con `pg_cron`           |
| Lógica que necesite estar cerca de la DB    | Edge Function                         |

---

## 5. Reglas RLS (Row Level Security)

### 5.1 Política base

- **Todas las tablas con datos del negocio tienen RLS activado.**
- Política base: usuario autenticado solo ve datos de su(s) tienda(s).
- Tabla `user_tiendas` mapea `user_id` ↔ `tienda_id` ↔ `rol`.

### 5.2 Política tipo por tabla

```sql
-- Ejemplo: política de SELECT en tabla 'sales'
create policy "users can read sales of their tienda"
  on sales for select
  using (
    tienda_id in (
      select tienda_id from user_tiendas
      where user_id = auth.uid()
    )
  );
```

### 5.3 Excepciones controladas

- Operaciones de admin global → service role dentro de una Edge Function (jamás expuesto al browser).
- Webhooks externos → Edge Function con service role + validación de firma.

---

## 6. Edge Functions: cuándo sí

Por defecto, **todo va por RPC + RLS desde la app Angular**. Edge Functions de Supabase solo en estos casos:

1. **Cron jobs** (sincronización periódica de estados de facturación).
2. **Webhooks de proveedores** que requieran respuesta rápida.
3. **Operaciones que necesiten estar geográficamente cerca de la DB** y tengan latencia crítica (no es nuestro caso en MVP).
4. **Cualquier flujo que requiera service role** (admin global, mutaciones masivas).

En MVP v1.0 esperamos **0 a 2 Edge Functions máximo**.

---

## 7. Manejo de secretos

| Secreto                             | Ubicación                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| `SUPABASE_URL`                      | `apps/pos-angular/src/environments/environment.ts`, OK al cliente |
| `SUPABASE_ANON_KEY`                 | `apps/pos-angular/src/environments/environment.ts`, OK al cliente |
| `SUPABASE_SERVICE_ROLE_KEY`         | Solo Edge Functions o scripts CLI locales (`scripts/`)       |
| API key de proveedor de facturación | Solo Edge Functions                                          |
| Cualquier credencial de tercero     | Solo Edge Functions                                          |

`.env.example` documenta todas las variables sin valores reales.

---

## 8. Testing

### 8.1 Pirámide (por capa, ADR 0015 §6.7)

- **`domain/` (mayoría):** vitest puro, sin mocks de framework.
- **`data/models`:** tests de mapeo fila ↔ entidad.
- **`data/repositories`:** contrato verificado contra fakes; la integración real la cubren smoke SQL + E2E Playwright.
- **`presentation/presenters` y `forms`:** tests con fakes del repositorio abstracto (Liskov en acción).
- **E2E (pocos):** flujo de venta end-to-end, cierre de caja.

Los tests viven en `tests/unit/features/<feature>/` (espejo) o co-ubicados como `*.test.ts` junto al código puro — ambos globs están en `vitest.config.ts`.

### 8.2 Cobertura mínima

- Umbral vigente en `vitest.config.ts`: **90%** (statements, branches, functions, lines) sobre `domain/dtos`, `domain/usecases`, `domain/services`, `presentation/forms` y `src/shared`.

---

## 9. CI/CD

### 9.1 Pipeline en cada PR

1. Install (`pnpm install --frozen-lockfile`).
2. Typecheck (`pnpm typecheck`).
3. Lint (`pnpm lint`).
4. Tests unitarios (`pnpm test`).
5. Build (`pnpm build`).

### 9.2 Deploy

- Decisión aceptada: **Netlify para el frontend estático + Supabase para backend** (ver ADR 0009).
- La app Angular es estática: `pnpm build` produce `dist/pos-angular/browser`.
- La configuración base vive en `netlify.toml`.

---

## 10. Observabilidad

En MVP:

- Logs de Supabase (Postgres + Auth + Edge Functions).
- Logs del hosting estático que se elija.
- Sentry para errores en cliente (plan gratuito).

Post-MVP: métricas de negocio en dashboard interno.
