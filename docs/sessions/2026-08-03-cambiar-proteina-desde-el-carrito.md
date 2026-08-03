# Spec de Sesión — 2026-08-03 — Cambiar el tipo de proteína desde el carrito

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Sprint | Sprint 4 |
| Agente | Claude Code |
| HUs trabajadas | PLAN-71 (ajuste de UX), RN-S14 |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Ajuste de UX pedido por el dueño sobre PLAN-71 (entregado ayer): el diálogo que se abre al
tocar un batido estorba. Un batido con CH+ es la venta normal — el 99% de los toques — y
obligar a confirmar la proteína cada vez agrega fricción al flujo más frecuente del negocio.

Nuevo comportamiento: tocar el batido lo agrega directo con CH+; la proteína se cambia desde
la línea del carrito solo cuando el cliente pide otra.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `tests/unit/app/features/pos/cart-option.test.ts` — 7 tests de `PosCartStore`: cambio de
  opción, fusión de líneas, recorte del descuento, canje que sigue a la línea, y acumulación
  vs. separación al agregar.
- `docs/sessions/2026-08-03-cambiar-proteina-desde-el-carrito.md` — este spec.

### 2.2 Archivos modificados
- `pos-cart.store.ts` — nuevo `updateOption(itemKey, option, basePrice)`.
- `pos.page.ts` — `selectProduct` agrega directo con la opción por defecto; nuevo
  `openItemOption(item)`; la señal `optionProduct` pasa a ser un `computed` derivado de la línea
  en edición (`optionItem`); chip clickeable con la proteína en la línea del carrito.
- `product-option.dialog.ts` — inputs `currentOptionId` y `confirmLabel`; al abrir preselecciona
  la opción vigente de la línea en vez de la de por defecto.
- `docs/adr/0017-opciones-de-producto-en-la-venta.md` — §2.5 revisada con el criterio nuevo y
  la razón del cambio.
- `docs/modules/sales.md` — RN-S14 con la UX nueva.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Agregar directo con la opción por defecto | Abrir el diálogo al tocar el producto (v1 de ayer) | El batido con CH+ es la venta normal. Cobrar un toque de confirmación en el 99% de los casos para servir al 1% es mal negocio de UX. |
| Chip en la línea del carrito que abre el mismo diálogo | Un `select` embebido en la línea, o rotar la proteína al tocar | El diálogo ya existía y muestra recargo y precio final, que es justo lo que el cajero necesita ver antes de confirmar. Rotar con toques sucesivos invita a errores silenciosos de precio. |
| Fusionar líneas al cambiar a una proteína que ya está en el carrito | Dejar dos líneas iguales | Dos líneas idénticas del mismo batido con la misma proteína no aportan nada y confunden el conteo. |
| Recortar el descuento manual al precio nuevo | Dejarlo tal cual | Bajar de Bipro ($15.000) a CH+ ($13.000) con un descuento de $15.000 dejaría un descuento mayor al precio: el RPC lo rechazaría al confirmar la venta. |
| El canje del Club sigue a la línea | Dejar que se invalide | La clave de la línea cambia al cambiar la opción; sin arrastrarlo, el canje desaparecía en silencio y el cajero tendría que volver a aplicarlo. |

---

## 4. ADRs creados o actualizados

- `docs/adr/0017-opciones-de-producto-en-la-venta.md` — §2.5 revisada: la opción ya no se elige
  al agregar sino desde el carrito. Queda registrada la razón del cambio de criterio.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó
- [x] `pnpm test` — 629 tests pasaron, 0 fallaron (70 archivos; +7 nuevos)

Hallazgo útil: `PosCartStore` se puede instanciar con `new` en vitest sin TestBed — solo usa
`signal`/`computed`, no `inject()`. Es la primera prueba de un store de presentación en el
proyecto y abre la puerta a cubrir el resto del carrito sin montar Angular.

---

## 6. Bloqueos y preguntas pendientes

_Lo que impidió avanzar o quedó sin resolver._

- [ ] Sigue pendiente la prueba manual en navegador de todo PLAN-71 (ayer no hubo stack local
      por Docker abajo; hoy tampoco se levantó).

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Probar en el POS: agregar un batido (debe entrar con CH+ sin preguntar), cambiar la proteína
   desde el chip, verificar precio y ticket.
2. Decidir si CH+ debe descontar del tarro `ISO CH+ 2LB` y con qué cantidad (hoy no descuenta).
3. Deuda conocida de PLAN-71: `void_sale_atomic` no devuelve componentes al anular — ni el vaso
   ni el sachet.

---

## 8. Notas adicionales

El estado de despliegue quedó así tras la sesión del 2026-08-02: `main` recibió el merge de los
34 commits acumulados (go-live del backlog de julio) y Netlify publica desde `main`. Las
migraciones de PLAN-71 ya estaban aplicadas al proyecto remoto antes del merge.
