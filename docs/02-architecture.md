# 02 — Arquitectura

> Reglas no negociables. Cualquier desviación requiere un ADR.

---

## 1. Stack tecnológico

| Capa | Tecnología | Versión / Notas |
|---|---|---|
| Framework | Next.js | 15+ (App Router) |
| Lenguaje | TypeScript | Strict mode |
| UI | React | 19+ |
| Estilos | Tailwind CSS | 4+ |
| Componentes | shadcn/ui | + Radix primitives |
| Base de datos | PostgreSQL | Vía Supabase |
| Auth | Supabase Auth | Email + password |
| Storage | Supabase Storage | Logos, PDFs, comprobantes |
| Edge Functions | Supabase Functions | Solo casos específicos (ver §6) |
| Realtime | Supabase Realtime | Opcional, no en MVP |
| Validación | Zod | Todos los bordes |
| Estado cliente | Zustand | Solo cuando React state no alcance |
| Data fetching | TanStack Query | + Server Components |
| Forms | React Hook Form | + Zod resolver |
| Tests | Vitest | Unitarios e integración |
| Tests E2E | Playwright | Solo flujos críticos |
| Linter | ESLint | Config Next + custom |
| Formatter | Prettier | Config estándar |
| Package manager | pnpm | Obligatorio (no npm/yarn) |
| Hosting frontend | Vercel | Plan Hobby al inicio |
| CI/CD | GitHub Actions | Deploy automático en main |

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
  issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>;
  voidDocument(documentId: string): Promise<Result<void, BillingError>>;
  getDocumentStatus(documentId: string): Promise<Result<BillingStatus, BillingError>>;
}

// infrastructure/billing/factus.adapter.ts
export class FactusAdapter implements BillingProvider { /* ... */ }

// infrastructure/billing/mock.adapter.ts (para tests y desarrollo)
export class MockBillingAdapter implements BillingProvider { /* ... */ }
```

### 2.3 Errores tipados con Result

No usar `throw` para errores de negocio. Usar tipo `Result<T, E>`:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
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
├── next.config.ts
├── tailwind.config.ts
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
├── public/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (app)/
│   │   │   ├── pos/               # Pantalla de venta
│   │   │   ├── productos/
│   │   │   ├── inventario/
│   │   │   ├── caja/
│   │   │   ├── reportes/
│   │   │   └── ajustes/
│   │   └── api/                   # Webhooks, no para CRUD interno
│   ├── modules/                   # Lógica de negocio por módulo
│   │   ├── auth/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── payments/
│   │   ├── cash-register/
│   │   ├── billing/
│   │   ├── customers/
│   │   └── reports/
│   ├── shared/                    # Compartido entre módulos
│   │   ├── components/            # Componentes UI genéricos
│   │   ├── lib/                   # Helpers, utils
│   │   ├── types/                 # Tipos compartidos
│   │   ├── result.ts              # Tipo Result<T, E>
│   │   └── validations/           # Schemas Zod compartidos
│   └── infrastructure/            # Cliente Supabase, configs
│       ├── supabase/
│       │   ├── client.ts          # Cliente browser
│       │   ├── server.ts          # Cliente server
│       │   └── service-role.ts    # Service role (server only)
│       └── config/
├── supabase/
│   ├── migrations/                # SQL versionado
│   ├── functions/                 # Edge Functions
│   ├── seed.sql                   # Datos de prueba
│   └── config.toml
└── tests/
    ├── unit/                      # Tests unitarios por módulo
    ├── integration/               # Tests de integración
    └── e2e/                       # Tests E2E críticos
```

---

## 4. Reglas de acceso a datos

### 4.1 Capas de acceso

```
React Component
    ↓
Server Action / Server Component
    ↓
Use Case (application layer)
    ↓
Repository Interface (domain)
    ↓
Repository Implementation (infrastructure, usa Supabase client)
    ↓
PostgreSQL (con RLS)
```

### 4.2 Cuándo usar qué cliente Supabase

| Cliente | Uso | Ubicación |
|---|---|---|
| `supabase/client.ts` | Componentes cliente (raros en este proyecto) | `'use client'` |
| `supabase/server.ts` | Server Components, Server Actions, Route Handlers | Server-only |
| `supabase/service-role.ts` | Operaciones que bypassean RLS (admin, webhooks) | Server-only, con cuidado |

**Regla:** nunca importar `service-role.ts` en código que pueda terminar en cliente. Está marcado con `import 'server-only'`.

### 4.3 Server Actions vs Edge Functions

| Caso | Usar |
|---|---|
| CRUD interno con auth de usuario | Server Action |
| Operaciones complejas con múltiples queries | Server Action |
| Webhooks de proveedores externos | Route Handler en `app/api/` |
| Cron jobs (sincronizar billing status) | Edge Function con pg_cron |
| Lógica que necesite ejecutarse cerca de DB | Edge Function |

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

- Operaciones de admin global → service role en Server Action.
- Webhooks externos → service role + validación de firma.

---

## 6. Edge Functions: cuándo sí

Por defecto, **todo va en Server Actions de Next.js**. Edge Functions de Supabase solo en estos casos:

1. **Cron jobs** (sincronización periódica de estados de facturación).
2. **Webhooks de proveedores** que requieran respuesta rápida y no quieras pasar por Vercel.
3. **Operaciones que necesiten estar geográficamente cerca de la DB** y tengan latencia crítica (no es nuestro caso en MVP).

En MVP v1.0 esperamos **0 a 2 Edge Functions máximo**.

---

## 7. Manejo de secretos

| Secreto | Ubicación |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, expuesto al cliente, OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, expuesto al cliente, OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Vercel env vars, server-only |
| API key de proveedor de facturación | Solo Vercel env vars, server-only |
| Cualquier credencial de tercero | Solo Vercel env vars, server-only |

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
- **`main`** → producción automática en Vercel.
- **PRs** → preview deploy en Vercel con DB de staging.

---

## 10. Observabilidad

En MVP:
- Logs de Vercel.
- Logs de Supabase.
- Sentry para errores en cliente y server (plan gratuito).

Post-MVP: métricas de negocio en dashboard interno.
