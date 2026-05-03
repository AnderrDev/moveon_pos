# 02 — Arquitectura

> Reglas no negociables. Cualquier desviación requiere un ADR.

---

## 1. Stack tecnológico

| Capa             | Tecnología             | Versión / Notas                                   |
| ---------------- | ---------------------- | ------------------------------------------------- |
| Framework        | Angular                | 21+ standalone PWA (ver ADR 0006)                 |
| Lenguaje         | TypeScript             | Strict mode                                       |
| UI               | Angular                | Standalone components + signals                   |
| Estilos          | Tailwind CSS           | 4+                                                |
| Componentes      | Angular propios        | Componentes standalone centralizados              |
| Base de datos    | PostgreSQL             | Vía Supabase                                      |
| Auth             | Supabase Auth          | Email + password                                  |
| Storage          | Supabase Storage       | Logos, PDFs, comprobantes                         |
| Edge Functions   | Supabase Functions     | Solo casos específicos (ver §6)                   |
| Realtime         | Supabase Realtime      | Opcional, no en MVP                               |
| Validación       | Zod                    | Todos los bordes                                  |
| Estado cliente   | Angular signals        | Stores `@Injectable` con `signal/computed`        |
| Data fetching    | Supabase JS            | RLS + RPC/Edge Functions para escrituras críticas |
| Forms            | Angular Reactive Forms | + Zod factory/mapper/presenter                    |
| Tests            | Vitest                 | Unitarios e integración (Angular tests pendientes)|
| Tests E2E        | Playwright             | Solo flujos críticos                              |
| Linter           | ESLint + @angular-eslint | Pendiente de cablear (ver TODO en sesión 05-02) |
| Formatter        | Prettier               | Config estándar                                   |
| Package manager  | pnpm                   | Obligatorio (no npm/yarn)                         |
| Hosting frontend | TBD                    | Build estático Angular; target post-cleanup       |
| CI/CD            | GitHub Actions         | Deploy automático en main (re-cablear post-cleanup)|

**Justificación de elecciones clave:** ver ADRs en `/docs/adr/`.

---

## 2. Principios arquitectónicos

### 2.1 Clean Architecture por módulos

Cada módulo de negocio se estructura en tres capas:

```
src/modules/<modulo>/
├── domain/               # TypeScript puro, sin dependencias
│   ├── entities/         # Sale, Product, CashSession, etc.
│   ├── value-objects/    # Money, TaxRate, Sku, etc.
│   ├── repositories/     # Interfaces (no implementaciones)
│   └── services/         # Reglas de negocio puras
├── application/          # Orquestación
│   ├── use-cases/        # CreateSale, CloseCashSession, etc.
│   └── dtos/             # Input/output schemas con Zod
└── infrastructure/       # Detalles técnicos
    ├── repositories/     # Implementaciones con Supabase
    ├── adapters/         # Adaptadores externos (billing, printing)
    └── mappers/          # DB row ↔ Domain entity
```

**Regla dura:** `domain/` no importa nada de `application/` ni `infrastructure/`. `application/` no importa `infrastructure/`. La inversión de dependencias se hace inyectando interfaces.

### 2.2 Patrón Adapter para integraciones externas

Cualquier integración con un sistema externo (proveedor de facturación, impresora, datáfono futuro) se implementa como adapter:

```typescript
// domain/billing/billing-provider.interface.ts
export interface BillingProvider {
  issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>
  voidDocument(documentId: string): Promise<Result<void, BillingError>>
  getDocumentStatus(documentId: string): Promise<Result<BillingStatus, BillingError>>
}

// infrastructure/billing/factus.adapter.ts
export class FactusAdapter implements BillingProvider {
  /* ... */
}

// infrastructure/billing/mock.adapter.ts (para tests y desarrollo)
export class MockBillingAdapter implements BillingProvider {
  /* ... */
}
```

### 2.3 Errores tipados con Result

No usar `throw` para errores de negocio. Usar tipo `Result<T, E>`:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

Solo `throw` para errores **técnicos** (DB caída, network failure). Errores de **dominio** (stock insuficiente, caja cerrada, descuento no autorizado) son `Result.error`.

### 2.4 Idempotencia

Operaciones críticas deben ser idempotentes:

- **Crear venta:** se acepta `idempotency_key` desde el cliente. Si llega duplicado, se devuelve la misma venta.
- **Emitir factura:** un `sale_id` solo se factura una vez. Reintentos no generan documentos duplicados.
- **Cerrar caja:** un `cash_session_id` solo se cierra una vez.

### 2.5 Multi-sede en datos

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
│   └── user-stories/
├── src/                           # Dominio puro reutilizable (TS sin frameworks)
│   ├── modules/                   # Lógica de negocio por módulo
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   └── forms/             # factory + mapper Zod
│   │   ├── products/
│   │   │   ├── application/{dtos,use-cases}/
│   │   │   ├── domain/
│   │   │   └── forms/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── cash-register/
│   │   ├── customers/
│   │   ├── payments/
│   │   ├── billing/
│   │   └── reports/
│   ├── shared/                    # Compartido entre módulos
│   │   ├── lib/                   # Helpers puros (format, payment-methods)
│   │   ├── types/                 # Tipos compartidos
│   │   ├── result.ts              # Tipo Result<T, E>
│   │   └── validations/           # Schemas Zod compartidos
│   └── infrastructure/
│       └── supabase/
│           └── database.types.ts  # Tipos generados desde Supabase
├── apps/
│   └── pos-angular/               # Angular 21 standalone PWA (UI + orquestación)
│       └── src/
│           ├── environments/
│           ├── styles.css         # Tailwind v4 (@import + @theme)
│           ├── index.html
│           ├── main.ts
│           └── app/
│               ├── core/          # session, supabase client, layout
│               ├── features/      # páginas, presenters, servicios y stores por módulo
│               └── shared/        # UI Angular reutilizable (cuando se necesite)
├── supabase/
│   ├── migrations/                # SQL versionado
│   ├── functions/                 # Edge Functions
│   ├── seed.sql                   # Datos de prueba
│   └── config.toml
├── scripts/                       # Utilidades CLI locales (seed admin, session-start)
└── tests/
    ├── unit/                      # Tests unitarios (dominio + DTOs + use-cases + forms)
    ├── integration/               # Tests de integración
    └── e2e/                       # Tests E2E (Playwright apuntando a localhost:4200)
```

---

## 4. Reglas de acceso a datos

### 4.1 Capas de acceso

```
Angular Component
    ↓
Presenter / Store / Application Service
    ↓
Use Case (application layer)
    ↓
Repository Interface (domain)
    ↓
Repository / Gateway Implementation (infrastructure, usa Supabase client o RPC)
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

### 8.1 Pirámide

- **Unitarios (mayoría):** lógica de dominio (`sales`, `inventory`, `cash-register`, `billing`).
- **Integración:** flujos completos a través de capas (use case + repo + DB de prueba).
- **E2E (pocos):** flujo de venta end-to-end, cierre de caja.

### 8.2 Cobertura mínima MVP

- Dominio: > 80%.
- Use cases: > 70%.
- UI: solo componentes con lógica compleja.

---

## 9. CI/CD

### 9.1 Pipeline en cada PR

1. Install (`pnpm install --frozen-lockfile`).
2. Typecheck (`pnpm typecheck`).
3. Lint (`pnpm lint`).
4. Tests unitarios (`pnpm test`).
5. Build (`pnpm build`).

### 9.2 Deploy

- Pendiente de definir tras el cleanup de Vercel/Next (sesión `2026-05-02-cleanup-next-vercel`).
- Opciones a evaluar: Cloudflare Pages, Netlify, Supabase Storage + CDN, GitHub Pages, contenedor en Hetzner. La app Angular es estática (`ng build pos-angular` produce `dist/pos-angular/browser`).
- Mientras se decide, `main` no tiene deploy automático.

---

## 10. Observabilidad

En MVP:

- Logs de Supabase (Postgres + Auth + Edge Functions).
- Logs del hosting estático que se elija.
- Sentry para errores en cliente (plan gratuito).

Post-MVP: métricas de negocio en dashboard interno.
