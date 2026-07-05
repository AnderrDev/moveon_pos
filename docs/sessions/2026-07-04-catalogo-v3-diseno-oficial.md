# Spec de Sesión — 2026-07-04 — Catálogo v3: implementar diseño oficial

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-04 |
| Sprint | Sprint 4 (paralelo) |
| Agente | Claude Code |
| HUs trabajadas | Catálogo público (fuera de HU formal) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Reemplazar el diseño actual de la página pública `/catalogo` por el **diseño oficial v3** creado en claude.ai/design (`Catalogo Move On v3.dc.html`, proyecto `e0d9c2e5-4562-4f81-9b79-edeb7e00fab3`), importado vía DesignSync, manteniendo la carga de datos real desde Supabase (`CatalogoService`).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `supabase/migrations/20260704_001_productos_marca_etiqueta.sql` — agrega `productos.marca` (text ≤120) y `productos.etiqueta` (text ≤40) para las tarjetas del catálogo. **Ya aplicada** en Supabase (proyecto POS `rmaieqyscchtxxkgxgik`).

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — **reescritura completa** con el diseño v3: tema oscuro `#0C0C0A` + amarillo `#F2C400`, tipografías Anton + Archivo (Google Fonts inline, lazy), header sticky, hero con ticker marquee, **catálogo acordeón** por categorías reales de BD (una abierta a la vez, Proteínas por defecto), tarjetas de producto (imagen real con fallback placeholder, marca con fallback a categoría, badge etiqueta, precio COP, CTA WhatsApp por producto), sección batidos estáticos ($8.000 agua / $10.000 leche), confianza (4 pilares), ubicación con horarios, footer con "MOVE ON→" gigante outline. Los `style-hover` del diseño se tradujeron a clases CSS `mo3-*`; el acordeón usa `<button>` (accesible) en vez de `<a href="#">`. Media query <720px para el header móvil (logo+CTA arriba, nav debajo).
- `apps/pos-angular/src/app/features/catalog/catalogo.service.ts` — `getCatalogo()` ahora trae `marca` y `etiqueta`; se eliminaron `getCombos()` y la interfaz `ComboSemana` (sin uso).

### 2.3 Archivos eliminados
- Ninguno. El código de combos, batido builder, partículas y stats se eliminó dentro de la reescritura de `catalogo.page.ts`. Los assets `public/assets/catalog/*` quedaron sin referencias pero no se borraron.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Fiel al diseño v3: se eliminan combos de la semana y batido builder | Adaptarlos a la estética v3 | Decisión del usuario; el v3 es el diseño oficial |
| Migración: `marca` + `etiqueta` en `productos` | Mostrar categoría sin cambios de BD | Decisión del usuario; productos sin marca muestran la categoría como fallback |
| Contacto con placeholders (`WHATSAPP_NUMBER`, `INSTAGRAM`, horarios) marcados con TODO | Datos reales | El usuario aún no tiene los datos definitivos |
| Categoría "Ingredientes para batidos" oculta en el catálogo (`HIDDEN_CATEGORIES` en la página) | Mostrarla | Contiene insumos internos, no productos vendibles al público |
| "Ver sachets →" ancla a `#catalogo` | Categoría "Sachets" dedicada | No existe esa categoría en BD; no se inventan datos |
| La tabla `combos_semana` NO se tocó | Borrarla | Los datos siguen ahí por si se retoma la sección |

---

## 4. ADRs creados o actualizados

- Ninguno (sin cambios arquitectónicos; se mantuvo el patrón página standalone + service existente).

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — 7 errores **preexistentes** en otros módulos (audit, inventory, products, reports); los archivos del catálogo solo tienen el warning `no-explicit-any` que ya existía en el service
- [x] `pnpm test` — 401 tests pasaron, 0 fallaron
- [x] Verificación visual con Playwright en `http://localhost:4200/catalogo` (desktop 1512px y móvil 390px): header sticky, marquee, acordeón abre/cierra, tarjetas con datos reales de Supabase, links `wa.me` correctos

---

## 6. Bloqueos y preguntas pendientes

- [ ] Datos reales del negocio pendientes: número de WhatsApp, handle de Instagram y horarios (constantes con `TODO` en `catalogo.page.ts`).
- [ ] Las columnas `marca` y `etiqueta` están vacías en BD — hay que poblarlas desde el módulo de productos o SQL para que las tarjetas muestren marca real (mientras tanto muestran la categoría).

---

## 7. Próximos pasos

1. Poblar `productos.marca` y `productos.etiqueta` con datos reales (y opcionalmente exponer los campos en el formulario de productos del POS).
2. Reemplazar placeholders de contacto cuando el negocio confirme los datos.
3. Opcional: iframe real de Google Maps en la sección Ubicación (hoy placeholder como en el diseño).
4. Opcional: limpiar assets sin uso en `public/assets/catalog/` y los errores de lint preexistentes de otros módulos.

---

## 8. Notas adicionales

- El diseño fuente vive en claude.ai/design proyecto `e0d9c2e5-4562-4f81-9b79-edeb7e00fab3` (archivos v1, v2 y v3; el oficial es v3). Se importó con la herramienta DesignSync (`list_files` + `get_file`).
- El catálogo pasó de 922 a ~440 líneas; ya no depende de assets de imagen locales (el logo es tipográfico "MOVE ON→" en Anton itálica).
- Las fuentes Anton/Archivo se cargan inline en el template (patrón previo del catálogo): solo se descargan al visitar `/catalogo`, no en el POS.
