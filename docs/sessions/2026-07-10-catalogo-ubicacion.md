# Spec de Sesión — 2026-07-10 — Catálogo ubicación

> Registro de trabajo de la sesión. Fuente de continuidad para el próximo agente.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-10 |
| Sprint | Post-Sprint 3 |
| Agente | Codex |
| HUs trabajadas | Revisión UI/UX catálogo; contacto dinámico catálogo; menú de batidos; ajuste UI/UX catálogo; refinamiento menú proteína; ajuste visual bases batidos; revert panel negro; horarios catálogo |
| Estado | Parcial: código listo, migración remota pendiente por credencial |

---

## 1. Objetivo de la sesión

Actualizar la ubicación real de Move On Nutrition en la página pública del catálogo, usando el enlace de Google Maps y el iframe embed entregados por el usuario. Además, mejorar el header móvil del catálogo para que no se vea pesado ni roto en pantallas pequeñas. Tras un checkout accidental, reimplementar los cambios perdidos del catálogo.

Actualización posterior: reemplazar el WhatsApp por `3012244006`, Instagram por `https://www.instagram.com/moveongear/` y crear una tabla para que esos datos se lean dinámicamente desde base de datos.

Actualización posterior 2: integrar en la sección amarilla de `/catalogo` el menú real de batidos visto en la captura del usuario: base en agua/leche, adicionales, toppings y toppings premium.

Actualización posterior 3: mejorar jerarquía UI/UX del catálogo y menú de batidos: números de sección más visibles, rótulos del menú más grandes, quitar emojis de agua/leche, agrandar el icono de búsqueda y hacer más legibles los conteos de categorías.

Actualización posterior 4: refinar específicamente el bloque izquierdo del “Menú de proteína”, convirtiéndolo en una pieza de menú con título fuerte, pasos visibles y bases mejor integradas.

Actualización posterior 5: reemplazar la línea diagonal negra en las cards `Base 01` y `Base 02` por una marca de esquina más limpia.

Actualización posterior 6: actualizar horarios públicos del catálogo a lunes a viernes `9:00 a.m. – 9:00 p.m.` y sábados/domingos `9:00 a.m. – 5:00 p.m.`.

Actualización posterior 7: revertir el panel negro de adicionales/toppings a su primera versión aprobada, sin encabezado extra ni cajas por ingrediente.

Actualización posterior 8: agregar al catálogo el menú real de café, snacks proteicos y combos visto en la captura del usuario (`Captura de pantalla 2026-07-09 a la(s) 11.26.08 p.m..png`), como nueva sección `#cafe` después de Batidos. Ajuste posterior del usuario: quitar el botón "Pedir por WhatsApp" de esa sección y mejorar el diseño (se veía plano).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `docs/sessions/2026-07-10-catalogo-ubicacion.md` — spec de sesión para registrar el cambio.
- `supabase/migrations/20260710_001_storefront_contact_settings.sql` — crea tabla pública de contacto, RLS y seed para la tienda principal.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — se reimplementaron los cambios perdidos por checkout: búsqueda + chips de categoría, grilla continua, paginación de 10 productos, cards compactas en móvil, escala tipográfica por tokens CSS, CTA “Cómo llegar” con link real de Google Maps, iframe embed oficial de Move On Nutrition y header móvil con menú hamburguesa no sticky.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — contacto ahora sale de `CatalogoService.getContactSettings()` con fallback local a `+57 301 224 4006` y `@moveongear`.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — sección amarilla de batidos convertida en menú completo: agua $11.000, leche $13.000, adicionales +$2.000, toppings $1.500 y toppings premium.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — refinamiento UI/UX: `01/02/03` con mayor jerarquía, buscador con SVG de lupa más grande, chips con conteos tipo badge, y bases del batido sin emojis con tratamiento tipográfico.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — bloque “Menú de proteína” reestructurado con título `Batido de proteína`, pasos `Elige base / Agrega sabor / Termina con toppings` y cards de base más compactas.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — reemplaza la barra diagonal negra en las bases por una esquina editorial con borde superior/derecho.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — restaura el panel negro de adicionales/toppings a la primera versión.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — actualiza etiquetas y valores de horarios en la sección de ubicación.
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — agrega sección `#cafe` (índice `03`, renumerando Ubicación a `04`): menú de Café y Snacks Proteicos en columnas con precio destacado en amarillo y badges de proteína por producto, y Combos como cards con esquina editorial (reutilizando `.mo3-shakebase`). Agrega el link "Café" a la navegación desktop/mobile y al footer. Se removió el CTA "Pedir por WhatsApp" de esta sección a pedido del usuario (el catálogo ya tiene CTA global en el header).
- `apps/pos-angular/src/app/features/catalog/catalogo.service.ts` — agrega lectura de `storefront_contact_settings`.
- `src/infrastructure/supabase/database.types.ts` — snapshot local de tipos Supabase actualizado.
- `docs/03-data-model.md` — documenta `storefront_contact_settings`.
- `docs/modules/settings.md` — documenta el contacto público del catálogo.

### 2.3 Archivos eliminados
- (no aplica)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Usar el iframe oficial entregado por el usuario | Mantener placeholder o usar solo enlace externo | Permite ver la ubicación dentro de la página y mantiene el CTA externo para navegación. |
| Usar menú hamburguesa solo en mobile | Mantener tabs horizontales visibles | Reduce altura y ruido visual en el primer viewport móvil. |
| Header móvil no sticky | Mantenerlo fijo/sticky en mobile | Evita ocupar espacio permanente y mejora la lectura del hero/catálogo. |
| Reemplazar el archivo completo al recuperar cambios | Parchar solo fragmentos del acordeón anterior | Evita estados intermedios mezclando markup viejo con signals nuevos. |
| Crear `storefront_contact_settings` en vez de usar `settings.data` | Guardar contacto en el JSON genérico existente | El usuario pidió una tabla explícita y el catálogo público necesita RLS de lectura anon más clara. |
| Mantener fallback local con los datos reales | Bloquear el catálogo si falla la tabla | Evita romper ambientes donde la migración aún no esté aplicada. |
| Redibujar el menú como HTML/CSS dentro de la franja amarilla | Pegar la foto del menú como imagen | Mantiene el texto legible, responsive y editable sin depender de una foto borrosa. |
| Sustituir emojis por tratamiento gráfico CSS | Mantener gota/vaso como iconos | Evita una señal visual genérica/de IA y mantiene el estilo brutalista de marca. |
| Convertir el bloque izquierdo en guía de armado | Mantener solo un titular grande y precios | Hace más claro el flujo de compra sin agregar interacción innecesaria. |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- [x] `pnpm exec tsc --noEmit` — pasó
- [x] `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` — pasó
- [ ] `pnpm lint` — falla por issues existentes fuera del cambio: `auditoria.page.ts`, `product-form.dialog.ts`, `productos.page.ts`, `reportes.page.ts` y warnings `any` en POS/productos.
- [x] `pnpm test` — 52 archivos, 446 tests pasaron

Detalle de fallos (si los hay):
- Se validó `/catalogo` con Chrome headless en mobile 390px: header cerrado 69px, menú abierto 239px, sin scroll horizontal, menú cerrado con `visibility:hidden`, sin errores de consola.
- Tras reimplementar por checkout accidental, se volvió a validar `/catalogo` con Chrome headless en desktop 1440px y mobile 390px: 10 cards por página, chips y búsqueda presentes, página 1 de 8, mapa embebido real cargado, sin scroll horizontal y sin errores de consola.
- `pnpm typecheck`: `tsc --noEmit` pasó, pero `ng build pos-angular --configuration development` abortó por deadlock interno de esbuild (`fatal error: all goroutines are asleep - deadlock`).
- Menú de batidos: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó; Chrome headless en desktop 1440 y mobile 390 sin overflow horizontal. Capturas: `catalogo-batidos-menu-new.png` y `catalogo-batidos-menu-mobile-new.png`. La consola muestra un 404 de recurso no bloqueante ya presente en la página.
- Ajuste UI/UX: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó; Chrome headless en desktop 1440 y mobile 390 sin overflow horizontal. Capturas: `catalogo-ux-desktop.png`, `catalogo-ux-mobile.png`, `catalogo-batidos-ux-desktop.png`, `catalogo-batidos-ux-mobile.png`. La consola mantiene el mismo 404 no bloqueante de recurso.
- Refinamiento menú proteína: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó; Chrome headless en desktop 1440 y mobile 390 sin overflow horizontal. Capturas: `catalogo-protein-menu-desktop.png`, `catalogo-protein-menu-mobile.png`, `catalogo-protein-menu-mobile-v2.png`.
- Ajuste visual bases batidos: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó; Chrome headless en desktop 1440 y mobile 390 sin overflow horizontal. Capturas: `catalogo-base-corner-desktop.png`, `catalogo-base-corner-mobile.png`.
- Horarios catálogo: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó.
- Menú café/snacks/combos: `pnpm exec tsc --noEmit` pasó; `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó; `pnpm test` 52 archivos / 446 tests pasaron. Validado con Chrome en `ng serve` desktop 1440px: sección `#cafe` visible desde el nav, precios y badges correctos contra la captura del usuario, sin errores de consola. Verificación de mobile se apoyó en el mismo patrón `grid-template-columns:repeat(auto-fit,minmax(...))` ya validado en 390px para las bases del batido (Codex, actualización posterior 3), dado que la herramienta de resize de ventana no reflejó el viewport en esta sesión.

---

## 6. Bloqueos y preguntas pendientes

- La migration `20260710_001_storefront_contact_settings.sql` no se pudo aplicar al Supabase remoto porque `SUPABASE_DB_URL` en `.env.local` fue rechazado por password authentication failed para `postgres`. En sandbox sin red primero falló DNS; con red aprobada llegó a Supabase y falló autenticación.
- El conector MCP de Supabase tampoco pudo usarse: respondió `Unauthorized` porque no tiene `SUPABASE_ACCESS_TOKEN` configurado.

---

## 7. Próximos pasos

1. Actualizar `SUPABASE_DB_URL` o configurar `SUPABASE_ACCESS_TOKEN` para aplicar `supabase/migrations/20260710_001_storefront_contact_settings.sql`.
2. Revisar visualmente en dispositivo real antes de publicar.

---

## 8. Notas adicionales

- El usuario entregó el link corto `https://maps.app.goo.gl/bkRg1w8si7BK9Rtq8`.
- El usuario entregó el iframe oficial de Google Maps para `Move On Nutrition`.
