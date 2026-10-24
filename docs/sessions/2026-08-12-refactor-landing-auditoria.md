# Spec de Sesión — 2026-08-12 — Refactor de `apps/landing-web` (hallazgos de la auditoría)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-12 |
| Sprint | — (deuda técnica, no HU) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna — deuda técnica de la auditoría 2026-08-08 |
| Estado | Completada (con un bloqueo abierto: migraciones de producción) |

---

## 1. Objetivo de la sesión

Aplicar los hallazgos de la auditoría de `apps/landing-web` (`docs/sessions/2026-08-08-auditoria-landing.md`), **excepto el de CI** (el dueño decidió que todavía no se necesita).

**Fuera de alcance:** cambios en `.github/workflows/ci.yml`.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/landing-web/src/app/features/catalog/catalog-content.ts` (103) — contenido estático del menú: batidos, café, snacks, combos, confianza, horarios, contacto por defecto. **Es el archivo donde se cambian los precios del menú.**
- `apps/landing-web/src/app/features/catalog/catalog-filters.ts` (76) — funciones puras: `normalize`, `visibleCategories`, `filterProducts`, `selectOffers`, `totalPages`, `paginate`, `shortText`.
- `apps/landing-web/src/app/features/catalog/catalog-filters.test.ts` (208) — 25 tests.
- `apps/landing-web/src/app/shared/whatsapp.ts` (17) — `whatsappLink()` + `WA_MENSAJES`, único lugar donde se arma la URL `wa.me`.
- `apps/landing-web/src/app/shared/whatsapp.test.ts` (30) — 4 tests.
- `apps/landing-web/src/app/features/catalog/catalogo.page.html` (459) y `catalogo.page.css` (205) — template y estilos extraídos del componente.

### 2.2 Archivos modificados
- `catalogo.page.ts` — **968 → 241 líneas**. Pasa a `templateUrl`/`styleUrl`, consume `catalog-content` y `catalog-filters`, reporta errores a Sentry. Los nombres de los miembros que usa el template no cambiaron (cero riesgo visual).
- `core/supabase/supabase-client.service.ts` — `autoRefreshToken`/`persistSession`/`detectSessionInUrl` en `false` (la landing es 100% anónima); se retira el import de `processLock`.
- `features/club/club-progress.component.ts` — el `catch` de `consultar()` ahora reporta a Sentry.
- `features/catalog/offers-carousel.component.ts` — usa el helper compartido de WhatsApp.
- `features/catalog/catalogo.service.ts` y `features/club/club-progress.service.ts` — comentarios corregidos: los casts estructurales no son por tipos viejos sino porque **las migraciones no están aplicadas en el remoto**.
- `vitest.config.ts` — incluye `apps/landing-web/src/app/**/*.test.ts`; agrega `catalog-filters.ts` y `whatsapp.ts` a la medición de cobertura.
- `docs/modules/catalogo.md` — nueva estructura de archivos + sección "Migraciones pendientes en producción".

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Descomponer por **archivos** (`templateUrl`/`styleUrl` + módulos de datos y lógica) en vez de por **subcomponentes de sección** | Extraer `mo-shakes-section`, `mo-coffee-section`, etc. | Las clases `mo3-*` son estilos de componente con encapsulación emulada: un subcomponente **no las hereda**, así que habría que migrar/duplicar el CSS con riesgo de regresión visual y sin tests de UI. El split por archivos captura casi toda la ganancia de mantenibilidad con riesgo ~cero. |
| Mantener los casts estructurales (`ContactClient`, `RpcClient`) | Regenerar tipos y borrarlos | Bloqueado: los objetos **no existen en el remoto**, así que `db:types` no puede tiparlos. Se documentó el porqué real y la condición para eliminarlos. |
| No actualizar `src/infrastructure/supabase/database.types.ts` | Sobrescribirlo con la regeneración | El remoto está **detrás** de las migraciones locales; regenerar desde ahí borraría tipos que el código local espera. Se hará junto con la aplicación de migraciones. |
| Alias en los imports (`shortText as truncate`, etc.) | Importar con el mismo nombre que los miembros de clase | Funciona por scoping (los miembros de clase no están en el scope léxico), pero se lee como recursión infinita. Los alias eliminan la trampa. |

---

## 4. ADRs creados o actualizados

- Ninguno. El refactor respeta ADR 0012 (sin Router, sin Tailwind, core duplicado) sin cambiar ninguna de sus decisiones.

---

## 5. Tests

- [x] `pnpm lint:landing` — pasó ("All files pass linting")
- [x] `pnpm typecheck:landing` — pasó
- [x] `pnpm build:landing` — pasó (433 kB raw / 106.8 kB transferencia; Sentry sigue en chunk lazy)
- [x] `pnpm test` — **698 tests en 75 archivos, todos verdes** (29 nuevos)
- [x] `pnpm test:coverage` — 99.72% statements / 92.57% branches, por encima del umbral de 90
- [x] **Verificación visual** con Playwright sobre `pnpm dev:landing`: render idéntico en las 8 secciones (header, hero+ticker, catálogo con 90 productos, batidos, club, café/combos, confianza, ubicación, footer).

---

## 6. Bloqueos y preguntas pendientes

- [ ] **DECISIÓN DEL DUEÑO: aplicar migraciones al proyecto Supabase de producción.** No se aplicó nada — es un cambio de estado en producción y queda fuera del alcance acordado. Evidencia recogida con `supabase migration list --linked` + sondeos REST:
  - `20260710000100` (`storefront_contact_settings`) → PGRST205. La vitrina cae al contacto por defecto; editar contacto desde el POS no tiene efecto.
  - `20260723020000` (RPC `storefront_club_progress`) → PGRST202. **La sección "Mi Club" está caída en producción para todos los visitantes** (ADR 0016 / PLAN-70 no está vivo).
  - Sin aplicar también: `20260624000100/200`, `20260710000200`, `20260723010000` (fuera del alcance de la landing, revisar aparte).
  - Ojo al aplicarlas: el historial está desalineado (`20260716000100/200` figuran sin aplicar pero sus objetos existen, registrados como `20260717224803/819`). **No usar `db push` a ciegas.**
- [ ] Después de aplicar: `pnpm db:types`, borrar los casts estructurales de `catalogo.service.ts` y `club-progress.service.ts`, y re-verificar typecheck del POS (los tipos regenerados incluyen `product_options`, que hoy falta en `database.types.ts`).

---

## 7. Próximos pasos

1. Decidir sobre las migraciones de producción (arriba) — es lo único que hoy tiene impacto en clientes reales.
2. Opcional, si se quiere seguir descomponiendo: promover el sistema `mo3-*` a `styles.css` global de `landing-web`. Eso elimina la restricción de encapsulación (documentada en los comentarios de `club-progress` y `offers-carousel`), habilita subcomponentes de sección y hace desaparecer el gotcha de los `@keyframes` renombrados. Es un cambio con riesgo visual real: hacerlo con verificación en navegador, no a ciegas.
3. Tests de componente Angular cuando exista el setup (vitest + @analogjs/vitest-angular), pendiente a nivel de todo el repo.

---

## 8. Notas adicionales

- `runtime-config.json` de ambas apps es **generado y gitignored**: cualquier `pnpm dev/build/typecheck` (`:landing` incluido) lo reescribe desde `.env.local`, que hoy apunta al **proyecto remoto**. Si se va a probar contra Supabase local hay que levantar el stack y regenerarlo — durante esta sesión el stack local estaba abajo, así que la verificación visual se hizo contra producción (solo lecturas anónimas del catálogo público, sin escrituras).
- El helper `whatsappLink` no valida el formato del número: si `storefront_contact_settings` llegara con basura, el enlace se arma igual. Hoy no importa porque el fallback es una constante, pero vale tenerlo presente cuando la tabla exista en producción.
