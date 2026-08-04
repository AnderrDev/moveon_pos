# Spec de Sesión — 2026-07-24 — Header del catálogo con carrusel de ofertas

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-24 |
| Sprint | Mejoras catálogo público (post PLAN-70) |
| Agente | Claude Code |
| HUs trabajadas | Pedido directo del dueño: rediseño del header con carrusel de ofertas para branding |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Rediseñar la zona del header del catálogo público (`apps/landing-web`) agregando un
carrusel de ofertas para mejorar el branding, dentro del diseño oficial v4
(negro + amarillo #F9D128, Montserrat, estética brutalist/deportiva).

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/landing-web/src/app/features/catalog/offers-carousel.component.ts` — componente
  standalone `mo-offers-carousel`: "cinta de ofertas" amarilla bajo la nav sticky.
  Franja de hazard stripes (cinta deportiva), sello negro "OFERTAS / y destacados en
  tienda", carrusel de un slide (imagen del producto o fallback negro "Move On",
  badge de etiqueta, nombre Montserrat 900, marca, CTA negro a WhatsApp), controles
  brutalist (flechas cuadradas, dots cuadrados, contador `01/03`), trama halftone que
  hace eco del hero. Auto-avance cada 5 s con pausa en hover/focus, swipe por pointer
  en móvil (con guarda anti-click accidental), `prefers-reduced-motion` desactiva
  autoplay y transición. Sin precios (la vista pública no los expone — migración
  `20260710000200`).

### 2.2 Archivos modificados
- `apps/landing-web/src/app/features/catalog/catalogo.page.ts` — computed `ofertas()`
  (productos con `etiqueta`, prioridad Promoción → Más vendido → Nuevo → otras, máx. 6),
  computed `whatsappNumber()`, render de `<mo-offers-carousel>` entre el header y el
  hero, oculto mientras carga o si no hay productos etiquetados.

### 2.3 Archivos eliminados
- (ninguno)

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Banda de ofertas no-sticky bajo la nav (fusionada visualmente al header) | Carrusel dentro del `<header>` sticky | El header sticky quedaría de ~240 px y robaría viewport al hacer scroll |
| Ofertas = productos con `etiqueta` (cualquiera), priorizando Promoción | Solo `etiqueta = 'Promoción'` | Si el dueño no tiene promos activas la banda desaparecería; con destacados siempre hay contenido |
| Sin precios en el carrusel | Mostrar precio de la oferta | La vista `storefront_productos_publicos` no expone precios a propósito; el CTA es preguntar por WhatsApp |
| Badges con estilos propios de la banda (fondo amarillo) | Reusar `BADGE_STYLES` de la página | El badge "Más vendido" es amarillo sobre negro: sobre la banda amarilla sería ilegible |
| Componente standalone separado con estilos propios | Meterlo en `catalogo.page.ts` | Mismo patrón que `club-progress.component.ts`; la encapsulación de Angular no hereda clases `mo3-*` de todas formas |

---

## 4. ADRs creados o actualizados

- (ninguno — es UI dentro del diseño oficial v4 ya decidido)

---

## 5. Tests

- [x] `pnpm typecheck:landing` — pasó (build dev OK)
- [x] `pnpm lint:landing` — pasó
- [x] `pnpm test` — 615 tests pasaron, 0 fallaron
- [x] Verificación visual en local (Supabase local + `ng serve landing-web`):
  desktop 1440px y móvil 390px, navegación con flechas OK, contador y dots OK.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Pregunta al dueño: ¿qué productos quiere etiquetar en prod? El carrusel solo
  aparece si hay productos con `etiqueta` (`Promoción`, `Más vendido`, `Nuevo` u otra).
  Hoy se gestionan desde el POS (campo etiqueta del producto).

---

## 7. Próximos pasos

1. Que el dueño etiquete productos reales en prod para que la cinta aparezca.
2. Opcional: link "Ofertas" en la nav si la banda gana peso comercial.
3. Commit de los cambios cuando el dueño dé el visto bueno al diseño.

---

## 8. Notas adicionales

- Para la prueba local se etiquetaron 3 productos QA en la DB local
  (`PROTEINA WHEY 2LB QA` = Promoción, `CREATINA 300G QA` = Más vendido,
  `GALLETA PROTEICA QA` = Nuevo). Quedan así en local como datos de prueba útiles;
  prod no se tocó.
- Durante la prueba se sobrescribió temporalmente
  `apps/landing-web/public/runtime-config.json` para apuntar al Supabase local;
  al final se regeneró con `node scripts/generate-runtime-config.mjs` (vuelve a prod).
- Screenshots de la verificación en el scratchpad de la sesión
  (`header-desktop.png`, `header-mobile.png`, `header-mobile-slide2.png`).
