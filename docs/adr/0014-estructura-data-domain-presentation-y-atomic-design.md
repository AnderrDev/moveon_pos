# ADR 0014 — Estructura data/domain/presentation + design system con atomic design

| Campo | Valor |
|---|---|
| Fecha | 2026-07-17 |
| Estado | **Parcialmente superseded por ADR 0015** (2026-07-22) — ver nota abajo |
| Decisores | Dueño del negocio (directriz) + Arquitecto (Claude) |
| Relacionado | Actualiza `docs/02-architecture.md` §2-3, `docs/standards/ui-components.md`, `docs/standards/forms.md`; sesión `docs/sessions/2026-07-17-reestructura-clean-atomic.md` |

> **Nota de estado (2026-07-22):** el ADR 0015 reemplazó la **sección A** de este ADR
> (el híbrido `src/modules/<mod>` puro + `apps/.../features/<mod>` Angular): hoy todo vive
> co-ubicado en `apps/pos-angular/src/app/features/<feature>/{domain,data,presentation}` y
> `src/modules/` ya no existe. **Sigue vigente** de este ADR: el design system atómico en
> `shared/{atoms,molecules,organisms,services}` (secciones C y D), el cableado hexagonal
> obligatorio (sección B, refinado por el ADR 0015 §6: contratos como `abstract class` y
> composition roots `<feature>.providers.ts`) y el patrón de formularios factory/mapper/
> presenter (reubicado a `presentation/forms/` + `presentation/presenters/`). Las rutas
> `src/modules/...` mencionadas abajo son historia — no las uses como referencia.

## Contexto

La Clean Architecture del proyecto creció de forma desigual:

- En `src/modules/` conviven **tres nomenclaturas**: módulos con `domain/ + application/ + infrastructure/` (products, sales, expenses…), módulos solo con `forms/` (auth, settings) y módulos casi vacíos (customers, audit). 84 archivos en total.
- El **cableado hexagonal real** (repositorio Angular que `implements` la interfaz de dominio + páginas que invocan use-cases) solo existe en `expenses`. Los demás repositorios de features (`products.repository.ts`, `customers.repository.ts`, etc.) van directo a Supabase con firmas propias, y las interfaces de dominio quedaron como documentación divergente.
- Los 98 archivos de `features/` viven planos en la raíz de cada feature (páginas, diálogos, repos, presenters mezclados).
- En la UI hay 16 componentes `mo-*` bien construidos pero sin taxonomía, y ~6 patrones visuales duplicados inline: card (×13), tabla cruda (×20 archivos), skeleton (×8), stat/KPI (×10), footer de diálogo (×14), pills a mano en `pos/`.

El dueño decidió reestructurar hacia capas **data / domain / presentation** con un **design system propio basado en atomic design**, reutilizando todo componente desde un botón.

## Decisión

### A. Capas: híbrido src/modules (puro) + features (Angular)

Se conserva la separación física que hace el dominio testeable sin Angular, renombrando capas a la nomenclatura nueva:

```
src/modules/<mod>/                      # TypeScript puro
├── domain/
│   ├── entities/                       # sin cambio
│   ├── value-objects/                  # sin cambio
│   ├── services/                       # sin cambio
│   ├── repositories/                   # interfaces (sin cambio de ubicación)
│   └── use-cases/                      # ANTES: application/use-cases/
├── data/
│   ├── dtos/                           # ANTES: application/dtos/
│   └── mappers/                        # ANTES: infrastructure/mappers/
└── forms/                              # sin cambio (factory + mapper Zod)

apps/pos-angular/src/app/features/<mod>/
├── data/                               # repos @Injectable Supabase que implements interfaces de dominio
└── presentation/
    ├── pages/                          # *.page.ts (rutas lazy)
    ├── dialogs/                        # *.dialog.ts
    ├── components/                     # componentes de vista del feature
    ├── presenters/                     # *.presenter.ts (forms)
    └── services/                       # stores, orquestación, export builders
```

**Mapeo viejo → nuevo:**

| Antes | Ahora |
|---|---|
| `src/modules/<m>/application/use-cases/` | `src/modules/<m>/domain/use-cases/` |
| `src/modules/<m>/application/dtos/` | `src/modules/<m>/data/dtos/` |
| `src/modules/<m>/infrastructure/mappers/` | `src/modules/<m>/data/mappers/` |
| `features/<m>/*.repository.ts` (raíz) | `features/<m>/data/` |
| `features/<m>/*.{page,dialog,component,presenter}.ts` (raíz) | `features/<m>/presentation/{pages,dialogs,components,presenters}/` |

**Reglas de dependencia:**

1. Nada en `src/modules/` importa Angular, RxJS, Supabase ni `@angular-app/`.
2. `domain/entities|value-objects|services` solo importan `@/shared`.
3. `domain/use-cases` y `domain/repositories` **pueden importar `data/dtos`** (los schemas Zod de borde son TS puro y son el contrato del caso de uso — patrón ya establecido por `expenses`). Es la excepción deliberada que hace el híbrido pragmático.
4. `data/mappers` importan `domain/entities` (row → entidad).
5. `features/<mod>/data/` es el **único** lugar que conoce tipos row de Supabase; implementa las interfaces de `@/modules/<mod>/domain/repositories`.
6. `features/<mod>/presentation/` no llama repositorios directamente para escrituras: invoca use-cases pasándoles el repo inyectado (`registerExpense({ repo, userId }, payload)`). Lecturas de listado pasan por use-cases triviales para mantener uniformidad.

### B. Cableado hexagonal obligatorio

Todo repositorio Angular `implements` su interfaz de dominio. Cuando la interfaz histórica diverge de la implementación real (caso products), **la interfaz se reescribe desde el uso real**, no al revés — el código en producción es la verdad operativa.

División de responsabilidades (patrón `expenses`):
- **Repositorio (impl):** acceso a datos, `throw` solo técnico, auditoría como detalle de infraestructura.
- **Use-case:** valida con schema Zod, orquesta, devuelve `Result<T, E>`.
- **Presenter/página:** valida el form (presenter), llama al use-case, traduce `Result` a UI.

### C. Design system: atomic design directamente en `shared/`

`apps/pos-angular/src/app/shared/` se reorganiza en `atoms/`, `molecules/`, `organisms/`, `services/` — sin carpeta `design-system/` intermedia (hay un solo design system; paths más cortos y menos moves).

Criterio de nivel:
- **atom** — un solo elemento HTML estilizado, sin composición: `button`, `badge`, `spinner`, `skeleton`, `card`.
- **molecule** — composición pequeña con API propia: los `form-*` (label+control+error vía `field-wrapper`), `empty-state`, `page-header`, `stat-card`, `dialog-footer`, primitivas de tabla.
- **organism** — overlay/estado global o composición con servicio: `dialog`, `toast`, `void-reason`, `sale-detail-list`.

Queda **prohibido** recrear inline los patrones extraídos (card, tabla, skeleton, stat, dialog-footer, pill/badge, spinner). El catálogo con API vive en `docs/standards/ui-components.md`.

### D. Tabla: primitivas estilizadas, no data-table genérico

Las ~20 tablas del repo son heterogéneas (badges en celdas, botones de acción, colspan, filas expandibles, footers de totales). Un `mo-data-table` genérico exigiría API de columnas + `ng-template` con contexto tipado — lo más costoso de mantener con strictTemplates — y obligaría a reescribir la lógica de cada tabla (alto riesgo en producción).

Se adoptan **primitivas de sustitución 1:1**: `mo-table-shell` (contenedor card+scroll) + directivas de atributo (`table[moTable]`, `thead[moThead]`, `th[moTh]`, `tr[moTr]`, `td[moTd]`) que centralizan el estilo sin tocar estructura HTML ni lógica. Si en el futuro 3+ tablas convergen en forma, podrá construirse `mo-data-table` encima de las primitivas con otro ADR.

### E. Migración incremental con pilotos

Producción está viva (50–100 ventas/día): la migración es por módulos, cada fase deja el repo en verde y commiteable.

- **Esta sesión:** ADR + reorganización de `shared/` + componentes nuevos + adopción del design system en todas las páginas + pilotos **products** y **customers** completos (estructura + cableado).
- **Sesiones futuras, en orden:** `sales` → `inventory` → `cash-register` → `loyalty` → `expenses` (solo renombre de carpetas, ya está cableado) → `reports` → `settings` → `auth` → `audit` → `pos`.
- `apps/landing-web` queda **fuera** (ADR 0012: app independiente sin Tailwind).

## Consecuencias

- `vitest.config.ts` mantiene **globs duales** en `coverage.include` (`application/**` legacy + `data/dtos/**`, `domain/use-cases/**` nuevos) mientras conviven ambas estructuras; al terminar la migración se eliminan los legacy.
- **Deuda anotada:** `data/mappers/**` no entra al denominador de cobertura (tampoco estaba `infrastructure/mappers/**`); medirlo al cerrar la migración.
- Los docs de arquitectura y estándares se actualizan en esta sesión y quedan como única fuente de verdad; los diagramas previos de `02-architecture.md` quedan superseded.
- Durante la convivencia, los módulos no migrados siguen funcionando con la estructura vieja — el checklist por módulo vive en el spec de sesión 2026-07-17.
- El refactor de `pos.page.ts` es deliberadamente conservador (solo sustitución visual); migrar su modal de cobro a `mo-dialog` requiere sesión futura con QA dedicado.
