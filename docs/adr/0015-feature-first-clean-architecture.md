# ADR 0015 — Clean Architecture feature-first: data / domain / presentation dentro de cada feature

| Campo | Valor |
|---|---|
| Fecha | 2026-07-17 |
| Estado | Propuesto — pendiente de validación del dueño |
| Decisores | Dueño del negocio (dirección explícita con captura de referencia) + Arquitecto (Claude) |
| Reemplaza | La sección "A. Capas: híbrido src/modules + features" del ADR 0014 (el design system atómico del ADR 0014 sigue vigente) |

---

## 1. Qué pidió el dueño

La referencia es la estructura Clean Architecture **feature-first** (estilo Flutter/Dart):
**cada feature es autocontenida** — sus tres capas viven juntas dentro de la carpeta de la
feature, no repartidas por el repo.

```
features/
└── auth/
    ├── data/
    │   ├── datasources/
    │   │   ├── auth_local_data_source
    │   │   └── auth_remote_data_source
    │   ├── models/
    │   │   └── user_model
    │   └── repositories/
    │       └── auth_repository_impl
    ├── domain/
    │   ├── entities/
    │   │   └── user
    │   ├── repositories/
    │   │   └── auth_repository        ← interfaz
    │   └── usecases/
    │       ├── get_current_user
    │       ├── sign_in_with_email
    │       └── sign_out
    └── presentation/
        └── ...
```

Lo que se rechaza del ADR 0014: el "híbrido" que dejaba el dominio en `src/modules/<modulo>`
(raíz del repo) y la presentación en `apps/pos-angular/src/app/features/<modulo>` — la misma
feature quedaba partida en dos árboles lejanos.

---

## 2. Estructura objetivo en ESTE proyecto

Todo vive en `apps/pos-angular/src/app/features/<feature>/`:

```
apps/pos-angular/src/app/features/<feature>/
├── data/                       # CÓMO se obtienen/persisten los datos
│   ├── datasources/            #   acceso crudo a lo externo: Supabase (queries/RPC),
│   │                           #   Storage, QZ Tray (impresora), etc.
│   ├── models/                 #   row types de la DB + mappers fila ↔ entidad
│   └── repositories/           #   <feature>.repository.ts — implementación que
│                               #   `implements` la interfaz del dominio
├── domain/                     # QUÉ hace el negocio — TypeScript PURO
│   ├── entities/               #   Product, Sale, Cliente, LoyaltyReward…
│   ├── value-objects/          #   Money, PhoneCO…
│   ├── repositories/           #   INTERFACES (contratos, sin implementación)
│   ├── services/               #   reglas puras: sale-calculator, stamps, nomina…
│   ├── usecases/               #   create-sale, transfer-stock, register-expense…
│   └── dtos/                   #   schemas Zod de borde (contratos de entrada/salida)
└── presentation/               # CÓMO se muestra — Angular
    ├── pages/                  #   *.page.ts (rutas)
    ├── dialogs/                #   *.dialog.ts
    ├── components/             #   *.component.ts propios de la feature
    ├── presenters/             #   *.presenter.ts + stores (signals)
    ├── forms/                  #   factory + mapper Zod del patrón de formularios
    └── services/               #   orquestación UI: exports Excel, error-mappers, helpers
```

### Ejemplo real — feature `products` ya migrada a este layout

```
features/products/
├── data/
│   ├── datasources/product-image-storage.service.ts
│   ├── import/siigo-csv.ts                  # importador puro (lo consume el script CLI)
│   ├── models/product.mapper.ts             # ProductRow + rowToProduct
│   └── repositories/products.repository.ts  # Supabase; implementará ProductRepository
├── domain/
│   ├── dtos/product.dto.ts · categoria.dto.ts
│   ├── entities/product.entity.ts
│   ├── repositories/product.repository.ts   # interfaz
│   └── usecases/list-productos.use-case.ts · list-categorias.use-case.ts
└── presentation/
    ├── pages/productos.page.ts · categorias.page.ts
    ├── dialogs/product-form.dialog.ts · categoria-form.dialog.ts
    ├── components/product-image-field.component.ts
    ├── presenters/product-form.presenter.ts · categoria-form.presenter.ts
    ├── forms/product-form.factory.ts · product-form.mapper.ts · …
    └── services/product-export.ts · products-cache.store.ts · product-component.helpers.ts
```

### Las 12 features

`audit` · `auth` · `cash-register` · `customers` · `expenses` · `inventory` · `loyalty` ·
`pos` · `products` · `reports` · `sales` · `settings`

Nota sobre `pos` vs `sales`: `sales` es el bounded context (dominio de la venta: entidades,
calculadora, repositorio); `pos` es la pantalla de venta (presentación pesada + datasources de
impresión). `pos` consume el dominio de `features/sales` — es la única dependencia
entre-features aceptada explícitamente.

---

## 3. Regla de dependencias (no negociable)

```
presentation ──→ domain ←── data
```

- **`domain/` no importa NADA de Angular, Supabase, RxJS ni de `data/` o `presentation/`.**
  Es TypeScript puro y testeable con vitest sin mocks de framework.
- **`data/` implementa las interfaces de `domain/repositories/`** y es el único lugar que
  conoce Supabase. Sus `models/` (rows + mappers) tampoco importan Angular.
- **`presentation/` invoca use-cases del dominio** (que reciben el repositorio-interfaz
  inyectado); no llama a `data/` directo para escrituras. `presentation/forms/` es TS puro
  (schemas Zod) aunque viva en presentación: es el contrato del formulario.
- Una feature **no importa de otra feature** salvo la excepción `pos → sales/domain`
  (documentada arriba). Lo compartido de verdad se promueve a `src/shared` o al design system.

## 4. Qué queda FUERA de las features (sin cambios)

| Ubicación | Contenido |
|---|---|
| `apps/pos-angular/src/app/shared/{atoms,molecules,organisms,services}` | Design system atómico (ADR 0014, vigente) |
| `apps/pos-angular/src/app/core/` | Sesión/auth guard, cliente Supabase, config runtime, layout, TiendaInfo |
| `src/shared/` | `result.ts`, tipos compartidos, validaciones Zod comunes, lib (format, payment-methods) |
| `src/infrastructure/supabase/database.types.ts` | Tipos generados de la DB |
| `tests/unit/features/<f>/` | Tests del dominio por feature (espejo de la estructura) |

`src/modules/` **desaparece por completo**.

## 5. Mapa de migración (de dónde viene cada cosa)

| Antes | Después |
|---|---|
| `src/modules/<f>/domain/**` | `features/<f>/domain/**` |
| `src/modules/<f>/application/use-cases/**` | `features/<f>/domain/usecases/**` |
| `src/modules/<f>/application/dtos/**` | `features/<f>/domain/dtos/**` |
| `src/modules/<f>/infrastructure/mappers/**` | `features/<f>/data/models/**` |
| `src/modules/<f>/forms/**` | `features/<f>/presentation/forms/**` |
| `src/modules/products/import/**` | `features/products/data/import/**` |
| `features/<f>/*.repository.ts` (Supabase) | `features/<f>/data/repositories/` |
| `features/<f>/infrastructure/*` (QZ, ESC/POS) | `features/<f>/data/datasources/` |
| `features/<f>/*.page.ts` | `features/<f>/presentation/pages/` |
| `features/<f>/*.dialog.ts` | `features/<f>/presentation/dialogs/` |
| `features/<f>/*.component.ts` | `features/<f>/presentation/components/` |
| `features/<f>/*.presenter.ts` / stores | `features/<f>/presentation/presenters/` |
| `features/<f>/` resto (exports, helpers, servicios UI) | `features/<f>/presentation/services/` |
| `tests/unit/modules/<f>/**` | `tests/unit/features/<f>/**` |

Los aliases no cambian: `@/` → `src/`, `@angular-app/` → `apps/pos-angular/src/app/`.
Los imports del dominio pasan de `@/modules/products/...` a
`@angular-app/features/products/domain/...`.

## 6. Adaptación correcta a Angular (esto es lo que hace la arquitectura real, no las carpetas)

Flutter usa get_it/injectable para inyectar; Angular tiene su propio inyector jerárquico.
Estas son las decisiones de adaptación:

### 6.1 Contratos de dominio como `abstract class` (no `interface`)

Las interfaces de TypeScript se borran en runtime → no sirven como token de DI. Una
**clase abstracta es TS puro** (cero imports de Angular) y sí existe en runtime, así que
funciona directamente como token del inyector. El dominio queda 100% puro Y inyectable:

```ts
// domain/repositories/product.repository.ts — TS PURO, sin imports de Angular
export abstract class ProductRepository {
  abstract search(params: SearchProductsParams): Promise<Result<Product[], RepoError>>
  abstract create(dto: CreateProductDto): Promise<Result<Product, RepoError>>
}

// data/repositories/supabase-product.repository.ts — Angular + Supabase
@Injectable()
export class SupabaseProductRepository extends ProductRepository { ... }
```

### 6.2 Composition root por feature: `<feature>.providers.ts`

El ÚNICO archivo que conoce dominio E implementación a la vez:

```ts
// features/products/products.providers.ts
export const productsProviders: Provider[] = [
  { provide: ProductRepository, useClass: SupabaseProductRepository },
]
```

Presentación inyecta la ABSTRACCIÓN: `inject(ProductRepository)` — nunca la clase Supabase.
(Dependency Inversion: presentación y dominio no saben que Supabase existe.)

**Registro: en `app.config.ts` (root), no por ruta — decisión revisada en PLAN-62.**
La idea original era registrar cada `<feature>.providers.ts` en la ruta lazy de esa
feature para que el árbol de DI respetara el lazy-loading. Al implementar PLAN-62 se
confirmó que no aplica a este proyecto: casi todos los repositorios se consumen desde
**múltiples rutas a la vez** (`InventoryRepository` desde `/pos`, `/inventario` y
`/reportes`; `AuditLogRepository` desde prácticamente todos los repos de datos;
`SaleRepository`/`LoyaltyRepository`/`CustomerRepository` igual). Angular resuelve
providers por el injector de la ruta que los declara — declararlos solo en la ruta
"dueña" los deja invisibles para las rutas hermanas que también los necesitan. Además
`withPreloading(PreloadAllModules)` ya precarga el código de todas las rutas, así que no
hay beneficio real de code-splitting que proteger escopando por ruta. Se registran todos
en `app.config.ts` importando cada `<feature>.providers.ts` — el archivo por feature
sigue siendo el composition root (dominio + implementación juntos), solo cambia dónde se
agrega a la lista de providers de Angular.

### 6.3 Use-cases: funciones puras con deps como argumento (patrón ya vigente)

```ts
// domain/usecases/create-product.usecase.ts — TS puro
export async function createProduct(
  deps: { repo: ProductRepository },
  input: CreateProductDto,
): Promise<Result<Product, CreateProductError>> { ... }

// presentation/pages/productos.page.ts
private readonly repo = inject(ProductRepository)
...
const result = await createProduct({ repo: this.repo }, dto)
```

Sin clases use-case con `@Injectable` (meterían Angular al dominio) y sin factory-providers
por use-case (ceremonia sin beneficio a esta escala). Regla: **toda ESCRITURA pasa por un
use-case**; las lecturas simples pueden llamar al repositorio-abstracción directo.

### 6.4 SOLID aplicado a este proyecto (con ejemplos reales)

| Principio | Cómo se cumple aquí |
|---|---|
| **S**ingle Responsibility | Un archivo = un motivo de cambio: datasource (query), model (mapeo), repo (contrato-impl), usecase (una operación de negocio), presenter (un formulario), page (una ruta). Límite duro: 300 líneas por archivo (ya vigente) |
| **O**pen/Closed | Nuevos métodos de pago / proveedores de facturación / impresoras = nueva implementación del contrato, sin tocar dominio (`BillingProvider`, `ReceiptPrinter` como abstract classes) |
| **L**iskov | Toda impl de un repositorio abstracto es sustituible: la Supabase real, un `InMemoryXRepository` para tests, un mock. Los tests de presenters usan fakes del contrato, no mocks de Supabase |
| **I**nterface Segregation | Contratos por capacidad, no god-repos: si `/reportes` solo lee ventas, consume `SaleReader` (contrato de lectura), no el `SaleRepository` completo de escritura |
| **D**ependency Inversion | Presentación → abstracción ← data (§6.1/6.2). Ninguna page/dialog/presenter importa de `data/`; eso lo garantiza el linter (§6.6) |

### 6.5 Catálogo de patrones canónicos del proyecto

| Patrón | Dónde | Regla |
|---|---|---|
| Repository | `domain/repositories` (contrato) + `data/repositories` (impl) | Nunca expone tipos de Supabase al dominio |
| Data Source | `data/datasources` | Acceso crudo a UN sistema externo (PostgREST, RPC, Storage, QZ). El repo compone datasources |
| Mapper/Model | `data/models` | Única frontera fila-DB ↔ entidad; snake_case muere aquí |
| Adapter | billing (futuro), impresión QZ | Contrato en dominio, adaptador en data; mock adapter para tests |
| Factory | `presentation/forms/*.factory.ts` | Schema Zod + defaults del formulario (fuente única de validación) |
| Presenter/Facade | `presentation/presenters` | La página no conoce FormGroup+Zod+repo a la vez; el presenter lo fachada |
| Observer | signals (`signal/computed/effect`) | Estado UI reactivo; stores por feature con `@Injectable` scoped a la ruta |
| Result | `src/shared/result.ts` | Errores de negocio como valores tipados; `throw` solo para fallos técnicos |
| Strategy | cálculo de descuentos/pagos | Variantes de regla como funciones puras intercambiables en domain/services |

### 6.6 Fronteras que se hacen cumplir SOLAS (no por disciplina)

Reglas de ESLint (`no-restricted-imports` por zona) que rompen el build si se violan:

1. `features/**/domain/**` no importa `@angular/*`, `@supabase/*`, `rxjs`, ni `../data`, `../presentation`.
2. `features/**/data/**` no importa `../presentation`.
3. `features/<a>/**` no importa `features/<b>/**` (excepción única declarada: `pos` → `sales/domain`).
4. `presentation/**` no importa `data/**` (solo abstracciones de dominio) — la excepción temporal por feature se retira al cablear cada una (checklist PLAN-64..67).
5. Nada fuera de `shared/{atoms,molecules,organisms}` define componentes UI genéricos.

### 6.7 Testing por capa

- `domain/`: vitest puro, sin mocks de framework (ya: 508 tests). Coverage ≥ 90% se mantiene.
- `data/models`: tests de mapeo fila ↔ entidad.
- `data/repositories`: contrato verificado contra fakes; la integración real la cubren
  smoke SQL + E2E Playwright (PLAN-29).
- `presentation/presenters` y `forms`: tests con fakes del repositorio abstracto (Liskov en acción).

## 7. Ejecución

Plan detallado y ejecutable: bloque PLAN-61..69 en `docs/plan-de-trabajo.md`.

## 8. Estado actual de la fase mecánica

- ✅ 210 archivos movidos con `git mv` (historia preservada) según el mapa §5.
- ✅ Imports reescritos en 181 archivos (codemod que resuelve cada import contra el mapa).
- ✅ `vitest.config.ts` (globs de coverage y tests) y `scripts/import-siigo-csv.mjs` apuntando
  a las rutas nuevas.
- ⏳ Pendiente: pasar typecheck/lint/tests y corregir residuos; actualizar docs; commit.
