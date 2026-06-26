# Spec de Sesión — 2026-06-25 — Catálogo Público: Mejoras visuales y batido interactivo

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-25 |
| Sprint | Sin sprint asignado (feature catálogo público) |
| Agente | Claude Code |
| HUs trabajadas | N/A — mejoras sobre el catálogo creado el 2026-06-24 |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Implementar 4 mejoras sobre el catálogo público (`/catalogo`) creado en la sesión anterior:
1. Hero animado con fondo interesante (no el negro estático)
2. Logo SVG de la marca MOVE ON recreado desde el brandbook
3. Imágenes visuales para las cards de combos (collage de productos)
4. Sección de batidos interactiva: el usuario arma su batido, ve el total y pide por WhatsApp

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` — reescritura completa del componente
- `apps/pos-angular/src/app/features/catalog/catalogo.service.ts` — servicio de datos (creado sesión anterior)
- `supabase/migrations/20260624_001_catalogo_publico.sql` — RLS anon + tabla combos_semana (aplicada sesión anterior)
- `supabase/migrations/20260624_002_product_image_url.sql` — columna image_url + 45 URLs (aplicada sesión anterior)
- `docs/sessions/2026-06-24-catalogo-publico.md` — spec de sesión anterior

### 2.2 Archivos modificados

- `apps/pos-angular/src/app/app.routes.ts` — ruta `/catalogo` pública (sesión anterior)

### 2.3 Decisiones de implementación de esta sesión

**Hero animado:**
- 12 partículas CSS hardcodeadas (posiciones fijas, no `Math.random()`) con `@keyframes float-up`
- Glow radial pulsante con `@keyframes glow-pulse`
- Texto con slide-in `@keyframes hero-in`

**Logo SVG:**
- Recreado inline, sin imagen externa
- Power button: arco con `stroke-dasharray="190 38"` para el gap en la parte superior + línea vertical
- "O" en MOVE = trazo blanco; "O" en ON = trazo amarillo `#F9D128`

**Collage de imágenes en combos:**
- `productByName` computed Map que indexa todos los productos por nombre uppercase
- `getComboImages(items)` busca hasta 3 imágenes por nombre y retorna `{url, nombre}[]`
- `getComboImgTransform(i, total)` aplica rotación CSS distinta a cada imagen en el overlay

**Batido builder:**
- Estado: `selectedBase = signal<CatalogoProducto | null>`, `selectedIngredients = signal<Map<string, CatalogoProducto>>`
- Computados: `batidoTotal`, `ingTotal`, `cupFillHeight`, `cupColor`
- Copa SVG animada: rect con `[attr.height]` y `[attr.y]` dinámicos, burbujas SVG con `<animate>`
- Animación "shaking" de la copa al seleccionar ingrediente: `cupShaking signal` + CSS `@keyframes shake`
- WhatsApp URL: mensaje pre-armado con base, ingredientes y total COP

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Partículas hardcodeadas (12 posiciones fijas) | `Math.random()` en clase | Evita problemas de hidratación SSR/CSR y diferencias entre renders |
| Logo SVG inline | Imagen PNG externa | Sin dependencia de asset, escalable a cualquier tamaño, colores controlables |
| `stroke-dasharray` para el arco del power button | `clip-path` o `arc path` complejo | Más simple de ajustar la longitud del gap |
| `CommonModule` import | Imports individuales de pipes | Consistencia con el resto del proyecto |
| Map para `selectedIngredients` | Array | Toggle O(1) y deduplicación sin lógica adicional |

---

## 4. ADRs creados o actualizados

_(ninguno — no se introdujeron patrones arquitectónicos nuevos)_

---

## 5. Tests

- [x] `pnpm typecheck` — ✅ 0 errores (build exitoso, chunk `catalogo-page` 119 kB)
- [x] `pnpm lint` — ⚠️ 2 warnings `no-explicit-any` en `catalogo.service.ts` (preexistentes, mismo patrón que el resto)
- [ ] `pnpm test` — no aplica (no hay lógica de dominio nueva, solo UI)
- [x] Verificación manual en browser — todas las secciones funcionales

---

## 6. Bloqueos y preguntas pendientes

- **Número WhatsApp:** `573001234567` es placeholder. Pendiente reemplazar con el real.
- **Panel admin de combos:** actualmente se editan directo en Supabase.

---

## 7. Próximos pasos

1. Reemplazar `WHATSAPP_NUMBER` en `catalogo.page.ts:12` con el número real de la tienda
2. (Opcional) Agregar SEO: `<title>` dinámico y `<meta>` description para el catálogo
3. (Opcional) Panel admin Angular para gestionar combos (CRUD básico)
4. Continuar con Sprint 4: módulo Clientes y Reportes

---

## 8. Notas adicionales

- El error 404 en `combos_semana` que apareció en el console log era de una sesión del browser anterior (antes de aplicar migrations). En la sesión actual la tabla existe con 3 combos activos y carga correctamente.
- Los PNG generados durante las pruebas (`catalogo-*.png`, `batido-*.png`, etc.) NO se deben commitear — son archivos temporales de prueba.
