# Módulo: App iOS del dueño

## Qué es

App nativa para iPhone con la que el dueño consulta el negocio fuera de la tienda: ventas, caja, stock y finanzas. Decisión y reglas en **ADR 0021**; plan en `docs/plan-de-trabajo.md` (PLAN-75..84).

- **Usuario:** solo rol `admin`. Un `cajero` que inicie sesión ve "Acceso solo para el dueño" y se cierra su sesión.
- **v1 de solo lectura.** No vende, no anula, no ajusta inventario ni registra gastos.
- **Backend:** el mismo proyecto Supabase del POS. Sin service role; solo URL + anon key.

## Dónde vive

Repo propio **`moveon-owner-ios`** (ADR 0021 §7), clonado junto a este como `../moveon-owner-ios`. Este documento, el ADR y el plan siguen viviendo aquí; las RPC `owner_*` y sus tests también.

```
moveon-owner-ios/
├── project.yml                  # Definición del proyecto (XcodeGen) — fuente de verdad
├── MoveOnOwner.xcodeproj        # GENERADO por `xcodegen`, no se versiona
├── Config/
│   ├── App.xcconfig             # Versionado: apunta al Supabase LOCAL por defecto
│   ├── Example.xcconfig         # Plantilla para otro backend (producción)
│   └── Local.xcconfig           # Opcional, fuera de git: sobrescribe App.xcconfig
├── MoveOnOwner/                 # App target SwiftUI
│   ├── App/                     #   @main, AppContainer (composition root), AppConfig
│   └── Features/<feature>/Presentation/   # Views + ViewModels (@Observable)
└── Packages/MoveOnKit/          # Swift Package local
    ├── Sources/Domain/          #   Swift puro, sin dependencias
    ├── Sources/Data/            #   Implementaciones Supabase (depende de supabase-swift)
    └── Tests/                   #   Swift Testing
```

**Fronteras (las hace cumplir `Package.swift`, no la disciplina):**

| Target | Puede importar | No puede importar |
|---|---|---|
| `Domain` | `Foundation` | `Supabase`, `SwiftUI`, `Data` |
| `Data` | `Domain`, `Supabase` | `SwiftUI` |
| App (`MoveOnOwner`) | `Domain`, `Data`, `SwiftUI` | — (solo `AppContainer` construye tipos de `Data`) |

Las vistas y view models reciben **protocolos de `Domain`**; solo `AppContainer` conoce las implementaciones de `Data` (equivalente a `<feature>.providers.ts`, ADR 0015).

## Pantallas (v1)

| Pantalla | Fuente de datos | PLAN |
|---|---|---|
| Login, gate de rol, Face ID | Supabase Auth + `user_tiendas` | 77 |
| Dashboard "Hoy" + selector de período | RPC `owner_sales_summary` (nueva), `cash_sessions`, `get_stock_levels` | 78, 79 |
| Ventas: lista y detalle | `sales`, `sale_items`, `payments` (lectura directa, RLS) | 80 |
| Caja: turno actual e historial | RPC `owner_cash_session_summary` (nueva), `list_cash_history_days` | 81 |
| Stock | `get_stock_levels`, `inventory_movements` | 82 |
| Finanzas | RPC `owner_finance_summary` (nueva), `get_monthly_sales_totals`, `get_monthly_expense_totals`, `get_reinvestment_fund_totals` | 83 |

## Autenticación (PLAN-77)

- `Domain/Auth`: `AuthRepository` (contrato), `OwnerAccessPolicy` (solo `admin`; con varias tiendas toma la primera donde es admin), `OwnerSession.signIn/restore` (revalidan el rol en cada apertura y **cierran sesión** si no es admin o si falla la lectura de `user_tiendas`), `LoginCredentials` (espejo de `loginFormSchema`).
- `Data/Auth`: `SupabaseAuthRepository` (sesión en Keychain vía SDK; renovación con límite de 10 s como `GET_SESSION_TIMEOUT_MS`; `signOut(scope: .local)`), `AuthFailureMapper` (mismos criterios que `login-error-mapper.ts`).
- App: `AppSession` (fases restaurando / login / Face ID / dentro). **Regla del dueño (2026-10-24): basta con contraseña o Face ID.** Con sesión guardada se pide Face ID (`deviceOwnerAuthenticationWithBiometrics`, sin respaldo con el código del iPhone); el botón "Entrar con contraseña" vuelve al login. Si el teléfono no tiene Face ID, la sesión guardada se cierra y se entra con la contraseña. No se bloquea al pasar a segundo plano.
- Recuperar contraseña envía el enlace a `PASSWORD_RESET_URL` (la página `/restablecer-contrasena` del POS web); la nueva contraseña se define allá. Mensaje genérico para no revelar si el correo existe.
- Usuario de prueba local adicional: `cajero@moveon.local` / `Test1234!` (rol `cajero`, solo en el stack local) para verificar el rechazo.

## Reglas

1. **No se reimplementan reducciones de negocio en Swift** (totales, utilidad, cuadres). Salen de RPC `owner_*` (`security invoker`, `stable`), cada una con un test de paridad contra el servicio TS que hoy calcula lo mismo:
   - `owner_sales_summary` ↔ `reports.repository.ts#getDailyReport` + `reports/domain/services/*`
   - `owner_cash_session_summary` ↔ `cash-register/domain/services/cash-closure.ts` y `cash-movement-summary.ts`
   - `owner_finance_summary` ↔ `expenses/domain/services/financial-summary.ts`
2. Sí se portan a Swift (con tests) reglas de presentación pequeñas: formato COP sin decimales (`es_CO`), fechas en `tiendas.timezone` (`America/Bogota`) y la regla de stock bajo de `low-stock.ts`.
3. Textos de UI en español; código en inglés.
4. Toda escritura futura (v2) pasa por una RPC `*_atomic`, nunca `insert`/`update` directos.
5. Pruebas con datos siempre contra Supabase local. El simulador llega a `http://127.0.0.1:54321`.

## Comandos

```bash
brew install xcodegen                 # una vez
# desde el repo moveon-owner-ios
scripts/test.sh                       # genera el proyecto y corre los tests (paquete + app)
open MoveOnOwner.xcodeproj

# Solo para apuntar a producción (nunca para pruebas con datos):
cp Config/Example.xcconfig Config/Local.xcconfig
```

En `.xcconfig` las URL se escriben con `/$()/` en lugar de `//` (`https:/$()/xxx.supabase.co`), porque `//` inicia un comentario.

## Distribución

Cuenta Apple Developer + TestFlight interno (ADR 0021 §6). Mientras no exista la cuenta: firma personal de Xcode en el iPhone del dueño (expira cada 7 días). **Pendiente:** decisión del dueño sobre la cuenta. Mientras tanto se trabaja con simulador y firma personal; la cuenta solo es necesaria en PLAN-84.
