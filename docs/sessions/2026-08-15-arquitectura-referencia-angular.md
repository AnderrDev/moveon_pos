# Spec de Sesión — 2026-08-15 — Arquitectura de referencia Angular + port real de la landing (proyecto nuevo, fuera de moveonapp-pos)

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-15 |
| Sprint | N/A (trabajo exploratorio, fuera del roadmap de sprints) |
| Agente | Claude Code |
| HUs trabajadas | Ninguna (no es trabajo sobre moveonapp-pos) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

**Fase 1:** el dueño pidió actuar como arquitecto Angular senior para diseñar y **scaffoldear un proyecto Angular nuevo, fuera del directorio `moveonapp-pos`**, con una arquitectura Clean Architecture explícita (domain / application / infrastructure / presentation, feature-based dentro de `features/`) usando Angular standalone + Signals + Supabase, sin lógica de negocio real todavía.

**Fase 2 (misma sesión, tras validar la estructura):** el dueño pidió implementar la landing **real** sobre ese esqueleto — mismo diseño, mismo contenido y catálogo conectado al Supabase real que usa `apps/landing-web` hoy, no una demo.

Este spec documenta la decisión y el resultado, aunque el código vive fuera de este repo, porque la sesión de Claude Code ocurrió en este working directory.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

Todo en `~/Documents/moveonapp-landing` (repo Angular nuevo e independiente, fuera de `moveonapp-pos`):

- Scaffold `ng new` (Angular 22, standalone, zoneless [default real del CLI hoy], Tailwind v4, vitest, prefix `mo`, sin SSR) + `@supabase/supabase-js`, `zod`, `@angular-eslint/schematics`.
- `src/app/core/` — `config/app-config.ts` (InjectionToken `APP_CONFIG`), `tokens/supabase-client.token.ts` (InjectionToken `SUPABASE_CLIENT` + `provideSupabaseClient()`), `guards/auth.guard.ts`, `interceptors/http-error.interceptor.ts`.
- `src/app/shared/` — `ui/button/`, `ui/card/`, `pipes/currency-cop.pipe.ts`, `utils/result.ts` (`Result<T,E>`).
- `src/app/domain/product/` — `entities/product.entity.ts` (+ spec), `entities/money.value-object.ts`, `repositories/product.repository.ts` (interfaz, TS puro).
- `src/app/application/product/` — `product.tokens.ts` (InjectionToken `PRODUCT_REPOSITORY`), `use-cases/get-available-products.use-case.ts` (+ spec con repo fake).
- `src/app/infrastructure/product/` — `product.mapper.ts` (Zod), `supabase-product.repository.ts`.
- `src/app/features/catalog/` — `pages/product-list.ts` (+html, usa `resource()`), `components/product-card.ts` (+html), `catalog.routes.ts` (lazy + providers a nivel de ruta), `catalog.providers.ts`.
- `eslint.config.js` — reglas de frontera de capas (`no-restricted-imports` por zona: domain no importa Angular/Supabase/otras capas; features no se importan entre sí, generado dinámicamente leyendo `src/app/features/`).
- `tsconfig.json` — alias `@app/*` → `src/app/*` para imports cross-capa.
- `README.md` — árbol completo, explicación de cada carpeta, ejemplo end-to-end, DI, convenciones, lazy loading, checklist de anti-patrones.

Verificado (fase 1): `ng build` (con lazy chunk `catalog-routes` separado del bundle principal), `ng test` (4 tests pasan), `ng lint` (0 errores; se probó deliberadamente que las reglas de frontera SÍ detectan una violación real).

**Fase 2 — port real de la landing** (reemplazó el dominio `product` de demo por el dominio real; leí `apps/landing-web` completo — `catalogo.page.{ts,html,css}`, `catalogo.service.ts`, `catalog-filters.ts`, `catalog-content.ts`, `offers-carousel.component.ts`, `club-progress.{component,service}.ts`, `shared/whatsapp.ts`, `core/{config,supabase}`, `docs/modules/catalogo.md` — antes de tocar código):

- `domain/{catalogo,contacto,club}/` — entidades reales: `Producto` (SIN precio/stock, la vista pública no los expone), `Categoria`, `ContactSettings` (+ `DEFAULT_CONTACT_SETTINGS`), `ClubProgress` (con `faltan`/`tieneRecompensaDisponible`/`sellos` como getters). `catalogo-rules.ts` — port de `catalog-filters.ts` (normalize/filterProducts/selectOffers/paginate/shortText) como funciones puras sobre las entidades nuevas.
- `application/{catalogo,contacto,club}/` — tokens + casos de uso (`GetCatalogoUseCase` aplica la regla de categorías ocultas; `GetContactSettingsUseCase` cae a `DEFAULT_CONTACT_SETTINGS` si la tabla falla o no existe; `LookupClubProgressUseCase`).
- `infrastructure/{catalogo,contacto,club}/` — mappers con Zod + repos Supabase (`storefront_productos_publicos`, `storefront_contact_settings`, RPC `storefront_club_progress`).
- `features/landing/` — `pages/landing-page.{ts,html,css}` (port 1:1 del diseño `mo3-*` completo: header, cinta de ofertas, hero, catálogo, batidos, club, café/snacks, confianza, ubicación, footer), `components/offers-carousel.ts` y `components/club-progress.ts` (`ClubProgressSection`, port de los componentes originales con sus estilos inline íntegros), `content/landing-content.ts` (menú fijo), `landing.providers.ts`.
- `shared/utils/whatsapp.ts` (+ spec) — port de `shared/whatsapp.ts`.
- `main.ts`/`app.config.ts` reescritos: **sin router** (bootstrapea `LandingPage` directo, igual que `landing-web` hoy — la app real tampoco usa Router, navega por anclas).
- `public/` — copiados los assets reales (`moveon-logo-brand.png`, `moveon-icon.png`, `apple-touch-icon.png`, `favicon-32x32.png`) desde `apps/landing-web/public`.
- `environment.ts`/`environment.development.ts` — credenciales reales del proyecto Supabase de producción (`rmaieqyscchtxxkgxgik`, misma anon key que usa `landing-web`; es pública por diseño).
- Eliminados: dominio `product` de demo completo, `shared/ui/{button,card}` (quedaban huérfanos, no los usa la landing real), Tailwind (`tailwindcss`, `@tailwindcss/postcss`, `.postcssrc.json`) — la landing real NO usa Tailwind a propósito (mismo criterio que ADR 0012 de `moveonapp-pos`), `app.ts`/`app.html`/`app.spec.ts`/`app.routes.ts`/`features/catalog/` (scaffold de demo de la fase 1).
- `angular.json` — presupuestos de bundle ajustados a los reales de `landing-web` (`anyComponentStyle` 24kB/48kB; el CSS de `landing-page.css` por sí solo pesa ~20KB, es un diseño rico).
- `README.md` reescrito para documentar la implementación real (tabla de qué está vivo vs. qué usa fallback, árbol actualizado, DI sin router).

Verificado (fase 2): `ng build`/`ng test` (29 tests)/`ng lint` en verde. **Verificación visual real con `ng serve` + Playwright**: el catálogo cargó productos reales de la tienda (BEST VEGAN, BEST WHEY, BIPRO...) agrupados por categoría real, el fallback de `storefront_contact_settings` se activó correctamente (404 esperado + warning), diseño idéntico al de producción en las 8 secciones.

### 2.2 Archivos modificados
- Ninguno en `moveonapp-pos` (el trabajo es en un proyecto nuevo externo). Solo se leyeron archivos de `apps/landing-web` y `docs/modules/catalogo.md` como fuente de verdad para el port.

### 2.3 Archivos eliminados
- Ninguno en `moveonapp-pos`.

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Arquitectura por capas (`domain/`, `application/`, `infrastructure/`, `features/`) en vez de feature-first (ADR 0015 de moveonapp-pos) | Replicar ADR 0015 tal cual | El dueño pidió explícitamente esta variante para el proyecto nuevo — no aplica a moveonapp-pos ni lo reemplaza |
| Sin router en `moveonapp-landing`, bootstrap directo de `LandingPage` | Mantener el `provideRouter` del scaffold de la fase 1 | Fidelidad a `landing-web`: es una sola página con anclas, nunca tuvo Router |
| Reemplazar completamente el dominio `product`/`shared/ui`/Tailwind de la fase 1 en vez de dejarlos junto al dominio real | Dejarlos como "ejemplo adicional" | Quedaban huérfanos (nada los usa) y Tailwind contradice el criterio real de `landing-web` (ADR 0012) — mantenerlos era ruido, no valor |
| Replicar el mismo comportamiento de degradación que producción (fallback de contacto, error genérico del club) en vez de "arreglar" las tablas/RPC faltantes | Aplicar las migraciones pendientes desde este proyecto | Fuera de alcance de la tarea pedida; esas migraciones pertenecen a `moveonapp-pos/supabase/migrations/` y ya están documentadas como pendientes en `docs/modules/catalogo.md` |

---

## 4. ADRs creados o actualizados

- Ninguno (proyecto nuevo fuera de moveonapp-pos; no aplica ADR de este repo)

---

## 5. Tests

- [ ] `pnpm typecheck` — N/A (proyecto externo)
- [ ] `pnpm lint` — N/A (proyecto externo)
- [ ] `pnpm test` — N/A (proyecto externo)

---

## 6. Bloqueos y preguntas pendientes

Ninguno pendiente — resueltas durante la sesión:
- Ubicación/nombre: `~/Documents/moveonapp-landing`.
- Alcance: scaffold real (`ng new` + `pnpm install`), no solo árbol de archivos.
- Zoneless/vitest: el dueño pidió inicialmente revertir a "lo normal de Angular"; se verificó con un `ng new` de control que el default actual del CLI (v22 en npm) **ya es zoneless + vitest sin ninguna flag extra** — no había nada que cambiar.

**Fase 3 (misma sesión) — reestructura a feature-first:** el dueño pidió, actuando yo como "desarrollador senior", mover la arquitectura de capas top-level (`domain/`, `application/`, `infrastructure/` compartidas por todo el proyecto) a **feature-first**: `features/<feature>/{domain,application,infrastructure,presentation}`, igual criterio que ADR 0015 de `moveonapp-pos`. Se ejecutó:

- Movidos `domain/{catalogo,contacto,club}`, `application/{catalogo,contacto,club}`, `infrastructure/{catalogo,contacto,club}` a `features/landing/{domain,application,infrastructure}/...`; `features/landing/{pages,components,content}` a `features/landing/presentation/{pages,components,content}`. `catalogo`/`contacto`/`club` quedaron como **agregados de dominio dentro de la feature `landing`**, no como features propias (no tienen página ni ruta propia — se documentó explícitamente en el README por qué, para que no se reinterprete distinto en el futuro).
- `eslint.config.js` reescrito: las reglas de frontera ahora son por **capa** (`domain/application/infrastructure/presentation`, sin importar a qué feature pertenezcan) en vez de por carpeta top-level; se agregó una regla nueva de `presentation/` (no puede inyectar `infrastructure/` directo) y se afinó la regla cross-feature para permitir `domain → domain` de otra feature pero bloquear `application/infrastructure/presentation` de otra feature (mismo criterio que la excepción `pos → sales/domain` de ADR 0015). Se probaron deliberadamente 2 violaciones (domain importando Angular, presentation importando infrastructure) — ambas detectadas correctamente.
- **Limpieza de código huérfano** encontrado en la revisión: `core/guards/auth.guard.ts` (nada usa guards, no hay router), `core/interceptors/http-error.interceptor.ts` + `provideHttpClient` en `app.config.ts` (nada inyecta `HttpClient` — todo pasa por el SDK de Supabase), `shared/pipes/currency-cop.pipe.ts` y `shared/utils/result.ts` (sobras del scaffold de demo de la fase 1, sin ningún consumidor), y la dependencia `@angular/router` en `package.json` (sin un solo import — la app nunca tuvo router). Todo esto era código especulativo sin consumidor real: se eliminó en vez de dejarlo "por si acaso".
- `README.md` reescrito de nuevo con el árbol feature-first definitivo y la tabla de qué va en cada carpeta actualizada.

Verificado tras la reestructura: `ng build`/`ng test` (29 tests)/`ng lint` en verde; **verificación visual de nuevo con `ng serve` + Playwright** — mismo resultado que la fase 2 (catálogo real cargando, mismo único error esperado del fallback de contacto), confirmando que el reordenamiento de archivos no rompió nada en runtime. Bundle bajó de 783KB a 756KB raw al quitar el `HttpClient`/interceptor muerto.

**Fase 4 (misma sesión) — componentización de la página + carpeta por componente:** el dueño pidió separar la página monolítica (`landing-page.html` tenía las 8 secciones inline, con toda la lógica del catálogo embebida en `LandingPage`) en componentes independientes reusables "desde cualquier página si se extiende luego", y que cada componente tuviera su propia carpeta. Antes de tocar código se confirmó con el dueño (pregunta explícita) el punto de diseño que más impacto tenía: si cada sección debía cargar sus propios datos de forma autocontenida, o seguir recibiéndolos ya cargados desde la página — eligió **autocontenidas**.

- Extraídos 8 componentes nuevos de sección (`header-nav`, `hero-section`, `catalog-section`, `batidos-section`, `cafe-section`, `confianza-section`, `ubicacion-section`, `footer-section`), cada uno inyectando su propio caso de uso (`GetCatalogoUseCase`/`GetContactSettingsUseCase`) en vez de recibir `@Input()`. `OffersCarousel` (ya existía) se migró al mismo patrón (antes recibía `productos`/`whatsappNumber` por input). `ClubProgressSection` ya era autocontenida, sin cambios.
- `GetContactSettingsUseCase.execute()` se hizo memoizado (cachea la promesa) porque hasta 6 componentes distintos lo inyectan de forma independiente — sin memoizar hubiera sido 6 requests idénticos a `storefront_contact_settings` por carga de página. Verificado con Playwright: sigue siendo **una sola** consulta real. `GetCatalogoUseCase` deliberadamente NO se memoizó (el dueño aceptó explícitamente que `CatalogSection` y `OffersCarousel` pidan el catálogo cada uno por su lado, 2 requests, aceptable a esta escala).
- El sistema visual `.mo3-*` (antes scopeado al único componente de página) se promovió a **CSS global** (`shared/styles/mo3-design-system.css`, cargado desde `angular.json`) — necesario porque la encapsulación emulada de Angular impide que el CSS de un componente estilice el DOM de otro componente hermano; al partir en 10 componentes que comparten las mismas clases, scopearlo a uno solo ya no servía. `OffersCarousel`/`ClubProgressSection` mantienen su CSS propio encapsulado (`.ofr-*`/`.club-*`) porque nadie más lo usa.
- `landing-page.ts` quedó reducido a pura composición (cero inyección, cero signals) — de ~210 líneas a 3 líneas de clase.
- A pedido explícito del dueño en el mismo mensaje: cada componente se movió a su propia carpeta (`components/<nombre>/<nombre>.ts` [+ `.html`]) en vez de todos sueltos en `components/`. Se evaluó si alguno calificaba como genérico para mover a `shared/` — ninguno calificó (todos conocen `Producto`/`ClubProgress`/contenido del negocio); se dejó la regla explícita en el README para el próximo componente que sí sea genérico.

Verificado: `ng build`/`ng test` (29 tests)/`ng lint` en verde en el primer intento tras la componentización y de nuevo tras el movimiento a carpetas. **Verificación visual con Playwright**: un screenshot de página completa mostró el header superpuesto sobre el hero — se investigó y es un artefacto conocido de Playwright/Chromium con `position: sticky` en capturas `fullPage` (stitching), no un bug real; un screenshot de viewport normal confirmó el diseño pixel-perfecto e idéntico al de antes de la componentización.

**Fase 5 (misma sesión) — verificación contra HUs + sección "Quiénes somos":** el dueño pidió verificar `moveonapp-landing` contra 4 HUs (conocer la marca, ver catálogo, ubicar sede, contactar por WhatsApp). Las 4 se cumplían, con dos matices: (1) el CTA de WhatsApp del header queda dentro del menú hamburguesa colapsado en móvil — mitigado por el botón de WhatsApp del hero, que sí es visible; (2) no existía una sección narrativa de marca, solo hero + franja de confianza.

El dueño pidió corregir el punto 2. Antes de escribir contenido sobre una marca real se le preguntó explícitamente si tenía copy real que pasar o si debía redactarlo yo mismo usando solo hechos ya verificados (sin inventar historia, fundadores ni cifras) — eligió lo segundo.

- Componente nuevo `quienes-somos-section` (con su propia carpeta), sección "Quiénes somos" insertada entre Hero y Catálogo (antes de la grilla 01-04 numerada, para no tener que renumerar nada). Contenido: qué venden, dónde, y horario — reutilizando `HORARIO_SEMANA`/`HORARIO_FESTIVOS` ya existentes en `landing-content.ts` (una sola fuente de verdad, no se retipeó el horario).
- Se agregó "Nosotros" (`#marca`) como primer link del nav en `header-nav.html`, para que la sección nueva sea alcanzable desde el menú igual que el resto.

Verificado: `ng build`/`ng test`/`ng lint` en verde; captura de viewport con Playwright confirmando que la sección se ve consistente con el resto del sistema visual (`.mo3-*`, sin CSS nuevo, reutilizando el lenguaje visual ya establecido).

---

## 7. Próximos pasos

1. Decidir si el dueño quiere hacer el primer commit real en `moveonapp-landing` (por ahora queda sin commitear más allá del commit inicial de `ng new`, a la espera de que el dueño revise).
2. Cuando se apliquen en `moveonapp-pos` las migraciones pendientes de `storefront_contact_settings` (`20260710000100`) y del RPC `storefront_club_progress` (`20260723020000`) — ver `docs/modules/catalogo.md` — el contacto y el club de `moveonapp-landing` empezarán a mostrar datos reales sin tocar código (ya están implementados, solo esperan que las tablas/RPC existan en el remoto).
3. Decidir dónde se despliega `moveonapp-landing` (hoy solo corre local) y si reemplaza a `apps/landing-web` o convive con ella durante una transición.
4. El bundle inicial pesa 764KB raw / 160KB gzip (por encima del warning de 500kB, pero dentro del error de 1MB) — mayormente `@supabase/supabase-js` + `lucide-angular`, más ahora 2 requests al catálogo (`CatalogSection` + `OffersCarousel`) en vez de 1. No es urgente a esta escala; si se vuelve un problema, memoizar `GetCatalogoUseCase` con el mismo patrón que ya tiene `GetContactSettingsUseCase`.
5. Si `catalogo`, `contacto` o `club` alguna vez ganan una página/flujo propio, promoverlos a features independientes (`features/catalogo/`, etc.) siguiendo el mismo patrón de 4 capas — el README ya deja esa regla explícita.
6. Si aparece un componente genuinamente genérico (botón, badge, modal — sin conocer ninguna entidad de negocio), va en `shared/`, no en `features/landing/presentation/components/` — regla ya documentada en el README para cuando aplique.

**Fase 6 (misma sesión) — paleta clara (blanco en vez de negro):** el dueño pidió cambiar todo el diseño de negro+amarillo a blanco+amarillo. Dado el volumen (~150 valores de color en 15+ archivos), antes de tocar código se confirmó con una pregunta explícita qué hacer con los bloques que eran negros como contraste deliberado dentro de secciones amarillas (header sticky, sección Mi Club, panel de menú de Batidos/Café) — el dueño eligió que también pasaran a claro, tema 100% coherente sin islas negras sueltas.

- `shared/styles/mo3-design-system.css` reescrito completo con una regla de conversión explícita (documentada en el propio archivo y en el README de `moveonapp-landing`, sección "Sistema de color"): superficies (fondo página/sección/tarjeta/input) pasan a blanco/gris claro; texto/borde en amarillo puro se vuelve dorado oscuro `#8A6A00` (el amarillo `#F9D128` como texto sobre blanco da ~1.4:1 de contraste, ilegible); el amarillo se mantiene sin cambios donde es FONDO con texto negro encima (botones, chips activos, tarjetas); botones/etiquetas deliberadamente negros (`mo3-btn-outline`, `mo3-blackbtn`, `mo3-shakekicker`, `mo3-pricepill`, `mo3-menubtn`) se dejaron negros a propósito como acento de marca; los bordes de 2px que separan celdas en Batidos/Café/Combos (técnica "grout") se dejaron negros como línea de diseño tipo papel cuadriculado, no como fondo.
- `club-progress.ts` (estilos propios `.club-*`) y las ~9 plantillas de sección con estilos inline se actualizaron con la misma regla. El estado de error de Mi Club pasó de amarillo (ilegible sobre blanco) a un rojo `#C0392B` con contraste real.
- `OffersCarousel` no necesitó ningún cambio — su banda amarilla + acentos negros ya tenía buen contraste, vive en su propia burbuja visual sin tocar el fondo general de la página.
- **Hallazgo importante durante la ejecución:** el logo real (`assets/catalog/moveon-logo-brand.png`) es blanco/transparente, diseñado para fondo oscuro — no hay variante para fondo claro entre los assets disponibles. Se resolvió poniéndole una placa negra detrás en los dos lugares donde aparece (header, footer) en vez de recolorear el archivo de marca — el logo se ve exactamente como lo entregó el negocio.

Verificado: `ng build`/`ng test`/`ng lint` en verde en el primer intento. **Verificación visual exhaustiva con Playwright**, sección por sección (header/hero, catálogo, Mi Club, Batidos, Café, ubicación, footer) — todas coherentes, legibles y con el logo visible en sus placas negras.

**Fase 7 (misma sesión) — un solo amarillo, sin dorado oscuro:** el dueño rechazó el dorado `#8A6A00` que se usó en la fase 6 para texto/borde sobre fondo blanco (lo introduje para resolver el contraste ilegible de amarillo puro sobre blanco, ~1.4:1) — lo calificó de "opaco" y "feo", y pidió que el amarillo fuera el mismo `#F9D128` en todas partes, sin variantes. Se revirtió con `sed` en los 8 archivos donde se había introducido (`mo3-design-system.css`, `club-progress.ts`, y 6 plantillas de sección), y se corrigió el comentario de cabecera de `mo3-design-system.css` que documentaba la regla vieja. El rojo de error de Mi Club (`#C0392B`) se dejó — no es una variante del amarillo, es un color semántico distinto y el dueño no lo mencionó.

Verificado de nuevo: `ng build`/`ng test`/`ng lint` en verde; captura visual de hero y catálogo confirmando el amarillo `#F9D128` consistente y vibrante en toda la página.

**Aprendizaje para la próxima vez:** en este proyecto, entre "contraste técnicamente correcto" y "un solo color de marca sin variantes", el dueño prioriza lo segundo — no proponer tonos derivados/oscurecidos de un color de marca sin preguntar primero si el look importa más que el contraste estricto. Guardado como memoria (`feedback_brand_color_consistency.md`).

**Fase 8 (misma sesión) — organizar el historial de git:** hasta este punto todo el trabajo de `moveonapp-landing` (fases 1-7) estaba sin commitear salvo el commit inicial de `ng new`. El dueño pidió "commits hechos por mi usuario no por Claude, todos ordenados, con historial desde hace dos semanas". Antes de tocar el historial se confirmaron dos cosas con una pregunta explícita (dado que "backdatear" el historial a 2 semanas habría sido fabricar fechas falsas para un proyecto creado íntegramente hoy):

- El autor de los commits ya era `Ander <cifuentees224@gmail.com>` (git config global de la máquina) — no había nada que arreglar ahí, el commit inicial de `ng new` ya estaba bien atribuido.
- Sobre "historial de dos semanas": se le explicó que el proyecto se creó hoy mismo en esta sesión, sin historial real de 2 semanas que reconstruir, y se ofrecieron 3 opciones. El dueño eligió organizar el trabajo de hoy en commits lógicos por fase, con la fecha real (hoy), en vez de backdatear.

Se dividieron los ~65 archivos sin commitear en **10 commits** (dependencias/build → core → shared → domain → application → infrastructure → composition root → presentation → bootstrap de la app + assets → docs), ordenados por dependencia (cada commit compila conceptualmente sobre lo anterior). Sin `Co-Authored-By: Claude` en los mensajes — el dueño pidió explícitamente que fueran commits suyos, no de Claude, así que se omitió el trailer que normalmente se agrega por default.

Verificado tras los 10 commits: `git status` limpio, `ng build`/`ng test`/`ng lint` en verde.

---

## 8. Notas adicionales

Este trabajo es explícitamente exploratorio/de referencia — no toca código de `moveonapp-pos`. Se documenta aquí solo para mantener continuidad de sesiones del dueño. El repo nuevo vive fuera de este monorepo por diseño; nada en `moveonapp-pos` fue modificado salvo este spec.

`moveonapp-landing` ya no es un esqueleto de ejemplo: es una implementación real y funcional de la landing, verificada visualmente contra el mismo backend Supabase de producción. Cualquier cambio de precio/producto en la tienda (vía POS) se refleja automáticamente ahí — no hay nada hardcodeado del catálogo, solo el menú fijo de batidos/café/snacks/combos (igual que en `landing-web`).
