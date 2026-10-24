# Spec de Sesión — 2026-10-24 — Rediseño con identidad MOVE ON (base + Punto de Venta)

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-24 |
| Sprint | Mejora continua (UI) |
| Agente | Claude Code |
| HUs trabajadas | — (pedido directo del dueño: "mejorar el diseño del POS") |
| Estado | Completada (sin commit) |

---

## 1. Objetivo de la sesión

El POS usaba naranja + fuente del sistema y un cuadro "M" como logo, mientras la marca (catálogo/landing) es negro + amarillo `#F9D128` + Montserrat. El dueño eligió: **adoptar la identidad MOVE ON** y empezar por **la base global + la pantalla Punto de Venta**.

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/pos-angular/public/assets/brand/moveon-logo.png` — logo oficial (copia de `apps/landing-web/public/assets/catalog/moveon-logo-brand.png`).

### 2.2 Archivos modificados
- `src/styles.css` — tokens: primary `#F9D128` con texto negro, neutros fríos sin tinte naranja, sidebar negro puro, ring negro, `--font-display` Montserrat.
- `src/index.html` — Montserrat (Google Fonts 600–900), `theme-color` negro.
- `core/layout/shell.component.ts` — sidebar con logo oficial, íconos lucide, grupos (Vender / Mercancía / Negocio / Sistema), ítem activo amarillo, rol real (Administrador/Cajero) y cerrar sesión como ícono. Móvil: barra con 3–4 accesos + "Más" (hoja inferior con el resto y cerrar sesión); antes eran 10 ítems con puntos.
- `features/pos/.../pos.page.ts` — cabecera con estado de caja (punto verde/rojo), catálogo y ticket como bloques separados.
- `features/pos/.../pos-catalog.component.ts` — buscador con ícono, chips de categoría negros, tarjetas sin etiquetas en mayúsculas: tarjeta entera agrega, ficha como ícono "i", precio en Montserrat negro; 2 columnas en móvil. Se quitó el input `cartItemCount` (ya no se mostraba).
- `features/pos/.../pos-cart-panel.component.ts` — "Venta actual" como ticket: cliente/Club en bloque gris, líneas con −/+ de ícono, descuento y borrar como acciones; **bloque de cobro negro** con total grande y botón amarillo "Cobrar". En móvil el carrito vacío se compacta.
- `shared/molecules/segmented.component.ts` — opción activa negra.
- `features/auth/.../login.page.ts` — cabecera negra con logo; "Contraseña" con ñ.
- `features/customers/.../clientes.page.ts` — corregido ícono de búsqueda superpuesto al texto.
- 19 archivos con `text-primary` → `text-foreground` (precios, totales, enlaces): el amarillo como texto sería ilegible. Estrellas/sellos vacíos del Club en gris.
- `docs/standards/ui-components.md` §5 — regla de íconos lucide y nueva §5.1 Identidad de marca.

## 3. Decisiones tomadas

- **Amarillo solo como relleno, nunca como texto** sobre fondo claro; énfasis con negro + peso. Sin tonos derivados (regla del dueño, ver memoria de consistencia de color).
- **Un solo momento de alto contraste por pantalla**: el bloque de cobro negro del ticket.
- Montserrat solo para display/precios; el cuerpo queda en fuente del sistema por densidad de tablas.
- `amber-*` sigue para avisos; no se confunde con la marca porque los avisos usan texto ámbar oscuro sobre fondo claro.

## 4. Verificación

- `pnpm typecheck` OK · `pnpm lint` OK · `pnpm test` 865/865.
- Navegador (stack local): POS escritorio 1440 y móvil 375 (agregar productos, ticket, hoja "Más"), Reportes, Clientes, Finanzas y Login. Diálogo de cobro no se abrió (solo heredó tokens).

## 5. Fase 2 — Caja, Reportes, Productos y Finanzas

Pedida por el dueño antes del commit.

- **Nuevo molecule `mo-menu` + `moMenuItem`** (`shared/molecules/menu.component.ts`): menú "⋯" de acciones secundarias. Panel `position: fixed` (no lo recortan tablas con scroll), se abre hacia arriba si no cabe, cierra al elegir/clic fuera/Escape/scroll. Documentado en ui-components.md §2–3.
- **Caja:** cabecera de 6 botones → "Registrar movimiento" + "Cerrar caja" (amarillo, antes rojo) + menú (registradora, Excel, corregir base, historial). Subtítulo con hora de apertura. `cash-turn-summary`: el número protagonista ahora es **efectivo esperado en el cajón** (antes la base), fila de 3 cifras, cuadre sin fuente mono, métodos de pago como lista.
- **Reportes:** pestañas principales arriba como barra subrayada (amarilla); sub-vistas de Ventas como píldoras negras.
- **Productos/Categorías:** mismas pestañas subrayadas; por fila "Editar" + menú (Desactivar, Eliminar en rojo) en vez de 3 botones de texto; tildes en textos.
- **Finanzas:** selector de mes con íconos y "Octubre de 2026" (antes "Octubre De 2026"); "Registrar gasto" primario; Excel al menú; cifras en Montserrat.
- **`mo-stat-card`** y cifras de Finanzas: etiqueta en tamaño oración, valor `font-display` extrabold.
- **Pasada global:** se quitaron `uppercase`/`tracking-*` de etiquetas en toda la app (salvo iniciales de avatar y códigos) y `text-[10px]` → `text-xs` en esas líneas, incluidos encabezados de tabla (`moThead`).
- Verificación: typecheck OK, lint OK, 865/865 tests; Playwright 1440px en Caja (menú abre y cierra al elegir), Reportes, Productos (menú de fila no recortado) y Finanzas.

## 6. Fase 3 — Productos (UX) y espaciados

Tras el commit `89f5656` (Productos e Inventario unificados en /productos) el dueño pidió mejorar la experiencia de Productos y corregir espaciados.

- **Productos:**
  - Vistas rápidas con conteo (`Activos · Por reponer · Inactivos · Todos`) en vez del select de estado + checkbox "Solo faltantes". Lógica pura en `product-stock.ts` (`matchesProductView`, `countProductViews`, `marginPercent`) con tests.
  - Subtítulo con productos activos y **valor del inventario a costo**.
  - Tabla de 4 columnas: producto (miniatura o inicial, tipo · categoría · SKU · proveedor, badge Inactivo), precio con costo y **margen %**, stock en punto de venta con estado y "Bodega n · mínimo n", acciones. Preparados/combos explican por qué no tienen stock.
  - Acciones: "Entrada" (ícono) + Editar + menú (ajustar, trasladar, kardex con nombres claros, desactivar, eliminar). Excel al menú.
  - Móvil: tarjetas en vez de tabla; filtros sin desbordarse.
  - Estados vacíos distintos para "nada por reponer" y "ningún producto coincide" (con Limpiar filtros).
- **Espaciados:** `mo-page-header` sin margen; todas las páginas usan `section flex flex-col gap-4` (antes 20 px en unas y 36 px en otras). Configuración ya no queda centrada/indentada respecto al resto. Buscador de Clientes a ancho completo en móvil. `mo-segmented` en una fila desplazable (Reportes y Productos ya no se parten en móvil). Encabezado de tablas con fondo sólido (`bg-muted`, antes translúcido sobre el contenido al hacer scroll).
- **Textos:** tildes en Configuración (Título, identificación, Teléfono, Dirección…); Categorías con la misma cabecera que Productos.
- No se tocó `features/audit/**` a pedido de la sesión "Revisión de cambios en dev", que está reescribiendo Auditoría (ella conserva el `gap-4` de la section).
- Verificación: build OK, lint OK, 877 tests; Playwright 1440 px y 390 px (sin desborde horizontal).

## 7. Próximos pasos

- Clientes en móvil: la tabla se corta; pasarla a tarjetas como Productos.
- En Caja, unir el filtro por método con el listado "Ventas del turno" (hoy son dos bloques).
- Revisar el diálogo de cobro y el historial de ventas con la nueva paleta.
