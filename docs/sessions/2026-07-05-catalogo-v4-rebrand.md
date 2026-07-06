# Spec de Sesión — 2026-07-05 — Catálogo v4: rebrand con logo e identidad oficial

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-05 |
| Sprint | Sprint 4 (paralelo) |
| Agente | Claude Code |
| HUs trabajadas | Catálogo público (fuera de HU formal) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

El usuario actualizó el diseño en claude.ai/design: apareció **`Catalogo Move On v4.dc.html`** (más carpeta `brand/` con logos oficiales). Aplicar el v4 tal cual sobre la implementación v3 del día anterior.

---

## 2. Lo que se implementó

El v4 es la **misma estructura** que el v3 con re-skin de identidad:

### 2.1 Archivos creados
- `apps/pos-angular/public/assets/catalog/moveon-logo-brand.png` — logo oficial "Move On Nutrition" (908×183, fondo transparente), descargado de `brand/logo-moveon.png` del proyecto de diseño vía DesignSync.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/catalog/catalogo.page.ts`:
  - **Tipografía:** Anton + Archivo → **Montserrat** (400–900 + italic 900); la clase `mo3-anton` pasó a `mo3-display` (Montserrat 900).
  - **Paleta:** `#0C0C0A`→`#000000`, `#EDEBE3`→`#FFFFFF`, `#9C9A8E`→`#9A9A9A`, `#4A493F`→`#606060`, `#F2C400`→`#F9D128`, hover `#FFDC33`→`#FFE159`, `#1A1913`→`#161616`, `#12110C`→`#0E0E0E`, `#161510`→`#141414`, `#33322B`→`#3A3A3A`, bordes `rgba(237,235,227,…)`→`rgba(255,255,255,…)`.
  - **Logo:** el texto "MOVE ON→" del header y el outline gigante del footer se reemplazaron por la **imagen del logo oficial** (header 30px de alto; footer centrado `min(560px,84vw)` con opacidad .9).
  - **Hero H1:** nuevo copy "Más energía. Más fuerza. **Más resultados.**" (span amarillo, sin itálica), `clamp(34px,6.8vw,92px)`.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Logo como PNG local en `assets/catalog/` | Referenciar URL externa | La página debe ser autocontenida; el asset viene del proyecto de diseño |
| Re-skin por reemplazo de tokens sobre el v3 | Reescribir la página | v4 tiene estructura idéntica al v3; solo cambian identidad y hero |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm test` — 434 tests pasaron, 0 fallaron
- [x] Verificación visual con Playwright (desktop 1440px y móvil 390px): logo en header/footer, Montserrat 900, paleta negra + `#F9D128`, acordeón y datos reales OK

---

## 6. Bloqueos y preguntas pendientes

- [ ] Siguen pendientes los datos reales de contacto (WhatsApp/Instagram/horarios) — ver spec 2026-07-04.

---

## 7. Próximos pasos

1. Los mismos del spec 2026-07-04 (poblar `marca`/`etiqueta`, contacto real, iframe de Maps).

---

## 8. Notas adicionales

- El diseño oficial ahora es **v4** (`Catalogo Move On v4.dc.html`). El proyecto de diseño también tiene `brand/` (logos claro/oscuro, brandbook PDF) y `uploads/` (fotos de la tienda) por si se necesitan después.
