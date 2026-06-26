# Sesión: Catálogo Público Web — MOVE ON

**Fecha:** 2026-06-24 / 2026-06-25  
**Rama:** main  
**Estado:** ✅ Completado

---

## HUs trabajadas

No había HU formal. Tarea solicitada directamente: página pública `/catalogo` sin login para que los clientes vean los productos con precios.

---

## Qué se construyó

### Página pública `/catalogo`

Ruta Angular standalone, sin auth guard, fuera del ShellComponent. Accesible desde cualquier browser sin login.

**Secciones:**
1. **Header sticky** — Logo SVG MOVE ON (recreado del brandbook) + botón WhatsApp
2. **Hero animado** — Fondo negro con glow amarillo pulsante, partículas de íconos power-button flotando, logo grande, CTA a suplementos y batido builder
3. **Stats bar** — Franja amarilla con 4 métricas (50+ productos, marcas top, 100% original, Bogotá)
4. **Combos de la semana** — 3 cards oscuras con collage de imágenes reales de los productos del combo, precio original tachado, badge de categoría, botón "Pedir combo" → WhatsApp
5. **Batido builder interactivo** — Selector de base (agua/leche), grid de ingredientes togglables con emoji/color, copa SVG animada que se llena al seleccionar, total en tiempo real, CTA "Pedir mi batido" → WhatsApp con mensaje pre-armado
6. **Catálogo de suplementos** — Nav sticky de categorías, grid de product cards con imágenes reales (45 productos con URLs de fabricantes), filtro por categoría
7. **Footer** — Branding MOVE ON + WhatsApp CTA

### Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `apps/pos-angular/src/app/features/catalog/catalogo.page.ts` | Creado / reescrito (v1 naranja → v2 marca) |
| `apps/pos-angular/src/app/features/catalog/catalogo.service.ts` | Creado |
| `apps/pos-angular/src/app/app.routes.ts` | Modificado (ruta `/catalogo` pública) |
| `supabase/migrations/20260624_001_catalogo_publico.sql` | Creado + aplicado |
| `supabase/migrations/20260624_002_product_image_url.sql` | Creado + aplicado |

### Migrations aplicadas en producción

- **001**: RLS anon SELECT en `productos` y `categorias` + tabla `combos_semana` con 3 combos seed
- **002**: Columna `image_url` en `productos` + 45 URLs de imágenes reales (ON, Dymatize, MuscleTech, Cellucor, BiPro, Proscience, Vindo, Unsplash)

---

## Decisiones técnicas

### Identidad de marca (del brandbook PDF)
- **Fondo:** #000 (negro total)
- **Acento:** #F9D128 (amarillo Move On)
- **Tipografía:** Montserrat 900 (cargada desde Google Fonts)
- **Logo SVG:** Power button en lugar de la "O" en "MOVE" y "ON". SVG inline con `stroke-dasharray` para el arco del círculo con gap en la parte superior.

### Logo SVG
Recreado desde el brandbook. El símbolo de power button (`⏻`) se representa como:
- Arco de círculo con gap en la parte superior (`path` + `stroke-dasharray="190 38"`)
- Línea vertical que atraviesa el gap
- La "O" en "MOVE" usa trazo blanco, la "O" en "ON" usa trazo amarillo

### Batido builder (Angular signals)
- `selectedBase = signal<CatalogoProducto | null>(null)`
- `selectedIngredients = signal<Map<string, CatalogoProducto>>(new Map())`
- `batidoTotal = computed(() => base.precio + sum(ingredientes))`
- `cupFillHeight = computed()` → controla la rect del SVG de la copa
- WhatsApp: `https://wa.me/573001234567?text=...` con mensaje pre-armado incluyendo base, ingredientes y total

### Collage de imágenes en combos
- `productByName = computed()` → Map<nombre_upper, CatalogoProducto>
- `getComboImages(items)` → busca imágenes de cada item por nombre, retorna máx 3
- `getComboImgTransform(i, total)` → CSS transform para posicionar las imágenes en overlay rotado

### Partículas hero
- 12 posiciones hardcodeadas para evitar problemas de hidratación con `Math.random()`
- CSS `@keyframes float-up` con `--dur` y `--delay` como custom properties por partícula
- Cada partícula es un SVG inline del power button icon

---

## Estado del build

- `pnpm typecheck` → ✅ 0 errores
- `pnpm lint` → ⚠️ 2 warnings `@typescript-eslint/no-explicit-any` en `catalogo.service.ts` (mismo patrón que el resto del codebase — `this.db.supabase as any`)
- Página verificada en browser → todos los módulos funcionales

---

## Número de WhatsApp

Actualmente hardcodeado como `573001234567` (placeholder). **Pendiente:** reemplazar con el número real de MOVE ON.

---

## Próximos pasos

- [ ] Reemplazar número de WhatsApp con el real
- [ ] Agregar panel admin para gestionar combos (por ahora se editan directo en Supabase)
- [ ] Mejorar el logo SVG (actualmente hecho con path SVG, podría mejorarse con Figma → export)
- [ ] SEO: agregar `<title>` y `<meta>` dinámicos para el catálogo
- [ ] Analytics: pixel de WhatsApp Business para rastrear conversiones desde el catálogo
