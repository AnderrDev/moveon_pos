# ADR 0021 — App iOS nativa (SwiftUI) para el dueño

**Fecha:** 2026-10-24
**Estado:** Aceptado (aprobado por el dueño el 2026-10-24)
**Decisor:** Dueño del producto
**Modifica:** ADR 0004 (PWA responsive, sin apps nativas) y la fila "App móvil nativa — No planeado" de `docs/01-mvp-scope.md`

## Contexto

El POS Angular (ADR 0006) está en producción y cubre la operación de caja en el computador de la tienda. El dueño necesita **consultar el negocio desde el iPhone** fuera de la tienda: cuánto se ha vendido, si la caja está abierta y cómo cerró, qué productos están sin stock y cómo van los gastos contra las entradas del mes.

La PWA no cubre bien este caso:

- Su layout está pensado para ≥ 768 px (ADR 0004 §Reglas derivadas); en un teléfono el POS, la caja y los reportes no son usables.
- `/reportes` y `/finanzas` son pantallas densas de escritorio (tablas, exportes Excel).
- En iOS una PWA no ofrece Face ID, widgets ni una sesión que sobreviva de forma fiable.

Hallazgos del análisis del código (2026-10-24) que condicionan la decisión:

1. **Las escrituras críticas ya son autoritativas en el servidor.** `create_sale_atomic`, `void_sale_atomic`, `close_cash_session_atomic`, `register_expense_atomic`, etc. son RPC `SECURITY DEFINER` que validan rol, tienda y montos. Un cliente nuevo no puede descuadrar datos.
2. **Muchas lecturas agregadas se calculan en el cliente.** `ReportsRepository.getDailyReport` descarga las ventas del período y las reduce en TypeScript (totales, desglose por método, por cajero, por hora, top productos, utilidad). `buildFinancialSummary` (utilidad neta) también es TS. Si la app Swift reimplementa esas reducciones, el iPhone y el web pueden mostrar **números distintos** para el mismo día.
3. Ya existen agregados en SQL que se pueden reutilizar: `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals`, `get_stock_levels`, `list_cash_history_days`.
4. RLS ya restringe gastos, empleados y plantillas a `admin` (`admin_only` en el módulo de gastos).

## Decisión

### 1. Producto

Crear una **app iOS nativa, solo para el rol `admin`**, enfocada en consulta: **"MOVE ON Dueño"** (nombre de trabajo).

- **v1 de solo lectura.** Dashboard de ventas, caja, stock y finanzas. Sin vender, anular, ajustar inventario ni registrar gastos desde el teléfono. Las escrituras quedan para una v2 explícita, y cuando lleguen usarán las mismas RPC `*_atomic` (nunca inserts directos).
- iPhone únicamente (vertical). iPad y un POS móvil quedan fuera de alcance.
- Un usuario con rol `cajero` que inicie sesión ve un mensaje de acceso denegado y se le cierra la sesión. RLS sigue siendo la barrera real; el bloqueo en la app es de UX.

### 2. Stack

| Capa | Elección |
|---|---|
| Lenguaje | Swift 6 (modo de concurrencia estricto) |
| UI | SwiftUI + `@Observable` (Observation), iOS 17+ como mínimo |
| Gráficas | Swift Charts (framework de Apple, sin dependencia externa) |
| Backend | El mismo proyecto Supabase, vía `supabase-swift` (Swift Package Manager) |
| Auth | Supabase Auth email + contraseña; la sesión la persiste el SDK en Keychain; bloqueo con Face ID (`LocalAuthentication`) al volver a la app |
| Tests | Swift Testing (`import Testing`) para dominio y view models |
| Proyecto | Repo propio `moveon-owner-ios` (ver §7), proyecto Xcode generado con XcodeGen y un Swift Package local para dominio/datos |

**Única dependencia de terceros:** `supabase-swift`. Cualquier otra requiere justificación (CLAUDE.md §3.4).

### 3. Arquitectura (espejo de ADR 0015 en Swift)

```
moveon-owner-ios/               # repo propio (§7)
├── project.yml                  # XcodeGen; el .xcodeproj se genera
├── MoveOnOwner/                 # App target: SwiftUI, composition root
│   ├── App/                     #   @main, AppContainer (DI), Config
│   └── Features/<feature>/Presentation/   # Views + ViewModels (@Observable)
└── Packages/MoveOnKit/          # Swift Package local
    ├── Sources/Domain/          # Swift puro: entidades, protocolos de repositorio, servicios
    ├── Sources/Data/            # Implementación Supabase de los protocolos + DTOs Decodable
    └── Tests/                   # Swift Testing
```

- **Domain** no importa `Supabase` ni `SwiftUI`. Lo garantiza el compilador: el target `Domain` no declara esas dependencias en `Package.swift` (equivalente a la frontera ESLint de ADR 0015 §6.6).
- **Repositorios como `protocol`** en Domain; implementación en Data; el `AppContainer` (composition root) los une. Las vistas reciben view models, nunca el cliente Supabase.
- **Errores:** `throws` tipados (`throws(DomainError)`) en lugar de `Result<T, E>`, que es el idioma de Swift 6. Los errores de red se mapean a un caso técnico.
- **Features v1:** `auth`, `dashboard`, `sales`, `cash`, `stock`, `finance`.

### 4. Lecturas: agregados en el servidor (regla nueva)

**Regla:** la app iOS **no reimplementa reducciones de negocio** (totales, utilidad, cuadres). Todo número que el dueño compara con el web sale de una RPC SQL de solo lectura.

- Se crean RPC nuevas `owner_*` (`security invoker`, respetan RLS, `stable`, sin escritura), por ejemplo `owner_sales_summary(p_tienda_id, p_from, p_to)` que devuelve en un JSON lo mismo que hoy calcula `getDailyReport` (totales, por método de pago, por cajero, por hora, top productos, utilidad con costo conocido).
- Se reutilizan las RPC existentes (`get_monthly_*`, `get_reinvestment_fund_totals`, `get_stock_levels`, `list_cash_history_days`) sin cambios.
- Los rangos de fecha los calcula el servidor con `tiendas.timezone` (hoy `America/Bogota`), igual que `day-range.ts`.
- **Paridad:** cada RPC `owner_*` lleva un test que compara su salida con la del servicio TS equivalente sobre los mismos datos de seed local. Más adelante el web puede migrar a estas RPC; no es requisito de este ADR.

### 5. Seguridad

- La app solo lleva `SUPABASE_URL` y la anon key (en un `.xcconfig` fuera de git, como `environment.ts`). Nunca service role.
- No se cachean datos financieros en disco fuera del sandbox de la app; la caché es en memoria (y como mucho el último snapshot del dashboard, marcado con hora).
- Pruebas con datos siempre contra Supabase local (regla del dueño). El simulador iOS llega al stack local en `127.0.0.1:54321`.

### 6. Distribución

- Cuenta Apple Developer (99 USD/año) a nombre del negocio, con distribución por **TestFlight** (interna) o Ad Hoc. No se publica en el App Store.
- Mientras no exista la cuenta, se instala en el iPhone del dueño con firma personal gratuita de Xcode (expira cada 7 días). Sirve para validar, no para operar.

### 7. Repositorio propio (enmienda del 2026-10-24)

El dueño decidió el mismo día que la app viva en **un repositorio aparte**, `moveon-owner-ios`, en lugar de `apps/ios-owner/` dentro del monorepo del POS.

- El repo iOS contiene solo el código Swift, su configuración y `scripts/test.sh`.
- **La documentación sigue siendo una sola fuente de verdad en este repo** (`/docs`): este ADR, `docs/modules/ios-owner.md`, el bloque PLAN-75..84 y los specs de sesión. El `CLAUDE.md` del repo iOS apunta aquí.
- **Las RPC `owner_*` y sus tests de paridad viven en este repo** (`supabase/migrations/`), porque la paridad se prueba contra los servicios TS del POS.
- Consecuencia: un cambio que toque RPC y pantalla requiere dos commits coordinados (primero la migración aquí, luego la app). Se acepta por mantener separados el toolchain de Xcode y el de pnpm/Netlify.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Hacer la PWA responsive para teléfono | Más barato, pero reescribe las pantallas más densas del POS y sigue sin Face ID ni widgets. El dueño eligió nativo. |
| React Native / Flutter | Reintroduce React (retirado a propósito) o un stack nuevo sin ventaja para un solo dueño en iPhone. |
| Capacitor envolviendo el Angular | Hereda los mismos layouts de escritorio; no resuelve el problema. |
| Portar a Swift las reducciones TS de `/reportes` | Duplica lógica en dos lenguajes y produce números distintos entre iPhone y web con el tiempo. |
| v1 con escrituras (gastos, ajustes) | Duplica validaciones Zod en Swift desde el día uno. Se deja para v2 cuando la lectura esté estable. |

## Consecuencias

### Positivas
- El dueño consulta el negocio en segundos, con Face ID, desde cualquier lugar.
- Cero cambios a las escrituras ni a RLS; el riesgo sobre la operación de caja es nulo.
- Las RPC `owner_*` dejan una fuente única para los agregados, que el web puede adoptar.

### Negativas
- Una segunda base de código en otro lenguaje que hay que mantener (Xcode, firma, versiones de iOS).
- Cada métrica nueva del dashboard requiere migración SQL + test de paridad.
- Costo anual de la cuenta Apple Developer.
- CI: `pnpm` no cubre la app; hace falta un job `xcodebuild test` en macOS (o correrlo localmente) antes de cada build.

### Reglas derivadas
- Toda escritura futura desde iOS pasa por una RPC `*_atomic` existente o nueva; nunca `insert`/`update` directos.
- Ninguna RPC `owner_*` es `security definer`.
- Los textos de UI van en español (es-CO), los montos en COP sin decimales, igual que `src/shared/lib/format`.
- El módulo se documenta en `docs/modules/ios-owner.md` (se crea en PLAN-75); su plan vive en `docs/plan-de-trabajo.md` (bloque PLAN-75..84).
