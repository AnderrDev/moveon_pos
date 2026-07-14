# Spec de Sesión — 2026-07-14 — Fondo dinámico en el hero del catálogo

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-14 |
| Sprint | n/a (mejora visual del catálogo público) |
| Agente | Claude Code |
| HUs trabajadas | n/a — solicitud directa de Ander |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Ander pidió evaluar (investigando en internet) si el hero del catálogo debería llevar un **video de fondo o una imagen dinámica** acorde al diseño oficial v4 (negro + amarillo #F9D128, Montserrat, estilo brutalista tipográfico), e implementar lo más adecuado.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- Ninguno.

### 2.2 Archivos modificados
- `apps/landing-web/src/app/features/catalog/catalogo.page.ts` — fondo dinámico del hero en CSS puro:
  - Keyframes nuevos: `mo-heroglow` (resplandor que respira, 13s alternate) y `mo-herodots` (trama que deriva en diagonal, 34s loop perfecto por múltiplos de background-size).
  - Clases nuevas: `.mo3-hero` (posicionamiento + gradiente base cálido), `.mo3-herobg` (capa aria-hidden), `.mo3-heroglow` (glow radial amarillo), `.mo3-herodots` (halftone de puntos amarillos enmascarado hacia la derecha), `.mo3-herograin` (grano SVG estático opacity .05), `.mo3-heroticker` (z-index del ticker sobre el fondo). Ajustes responsive <720px (glow reposicionado, máscara más abajo).
  - Markup: `section#inicio` ahora lleva `class="mo3-hero"` + capa `.mo3-herobg` con las 3 subcapas.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Fondo dinámico en CSS puro (glow + halftone + grano) | Video de stock de gimnasio de fondo | Un video pesa 2–10 MB, daña LCP en móvil (público principal), requiere fallback estático <768px, y footage de personas choca con la identidad brutalista tipográfica v4. El motion sutil CSS pesa 0 KB, usa la paleta exacta y es la tendencia 2026 para este estilo (kinetic/subtle motion sobre base negra + un acento). |
| Trama de puntos enmascarada hacia el lado derecho | Puntos en toda el área | Mantener limpio el lado izquierdo donde vive el titular. |
| Sin cambios a `prefers-reduced-motion` | — | El kill-switch global del componente (`animation:none!important`) ya congela las capas nuevas; quedan como fondo estático válido. |

**Investigación (fuentes clave):** buenas prácticas de video hero (Design TLC, HostArmada, GoStellar: ≤10 MB, loop 10–30s, muted/autoplay, fallback móvil); tendencia brutalista 2026 (Superdesign, NN/g, Gezar: base negra + acento ácido + motion sutil). Si algún día se quiere video real: Mixkit `/free-stock-video/gym/`, Coverr `/stock-video-footage/gym`, Pexels `/search/videos/gym/` (licencia libre).

---

## 4. ADRs creados o actualizados

- Ninguno (cambio visual dentro del patrón existente del componente).

---

## 5. Tests

- [x] `pnpm lint:landing` — pasó
- [x] Verificación visual con Playwright sobre `ng serve` local (desktop 1440px y móvil 390px) — texto legible, glow y puntos sutiles, ticker intacto
- [ ] `pnpm test` — no aplica (sin lógica nueva)

Nota: en dev apareció un 404 preexistente a `storefront_contact_settings` en Supabase (el servicio cae a los defaults hardcodeados). No relacionado con este cambio.

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Próximos pasos

1. Ander valida el resultado en `pnpm dev:landing` y decide si ajustar intensidad (opacidades en `.mo3-heroglow` / `.mo3-herodots`).
2. Si se prefiere video real: elegir clip oscuro de Mixkit/Coverr, comprimir a WebM/MP4 ≤5 MB, `<video muted autoplay loop playsinline>` + poster + overlay negro y ocultarlo <768px (investigación ya documentada arriba).
3. Commit pendiente (no se hizo commit en esta sesión).

---

## 8. Notas adicionales

- Todas las capas del fondo son `pointer-events:none` y `aria-hidden="true"`; no afectan accesibilidad ni interacción.
- El 404 de `storefront_contact_settings` conviene revisarlo aparte: la tabla no existe o RLS la bloquea en el proyecto Supabase remoto.

## 9. Segunda parte de la sesión — ticker del hero

- Ander pidió que la cinta amarilla se moviera "como carrusel". Se descubrió que **nunca se estaba animando**: Angular con encapsulación emulada renombra los `@keyframes` declarados en el `<style>` del componente, así que las animaciones referenciadas desde atributos `style=""` inline del template (ticker `mo-marquee` y skeleton `mo-pulse`) quedaban rotas. Las referencias desde clases del mismo `<style>` sí se reescriben (por eso el glow/halftone nuevos funcionaban).
- **Fix:** clases `.mo3-tickertrack` (marquee 26s) y `.mo3-skelpulse` (pulse skeleton) en el `<style>` del componente, reemplazando las declaraciones inline. Verificado con Playwright que el transform del track avanza (~66 px/s).
- **Regla para el futuro:** en este componente, nunca referenciar `animation:` desde `style=""` inline — siempre vía clase (comentario dejado en el propio archivo).
- Se probó también una segunda cinta negra en contra-desplazamiento con texto en contorno amarillo; Ander la descartó ("se ve feo") y se revirtió.

## 10. Tercera parte — scroll suave del navbar

- **Objetivo:** que los anclajes del navbar (`#catalogo`, `#batidos`, `#cafe`, `#ubicacion`, `#contacto`) lleguen a su sección con movimiento suave y sin quedar tapados por el header sticky.
- **Cambios:**
  - `apps/landing-web/src/styles.css` — `html{scroll-behavior:smooth}` (el bloque `prefers-reduced-motion` existente ya lo revierte a `auto`).
  - `catalogo.page.ts` — `scroll-margin-top:61px` en secciones/footer con id (compensa el header sticky de 61px en desktop) y `8px` en móvil (header estático).
  - `catalogo.page.ts` — `closeMobileMenu()` ahora re-alinea el destino tras el colapso del menú móvil (240ms): el colapso restaba ~214px de altura sobre el ancla mientras el scroll estaba en vuelo y la página aterrizaba pasada de la sección.
- **Verificación (Playwright):** desktop: batidos/café/ubicación aterrizan a 0px del borde del header, catálogo a 61px exactos del viewport; móvil: menú se cierra y las secciones aterrizan a 8px. `#contacto` queda a ~415px porque el footer está al final del documento y no puede subir más (comportamiento correcto del navegador). `pnpm lint:landing` y `pnpm typecheck:landing` pasan.
