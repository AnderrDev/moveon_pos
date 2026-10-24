# Spec de Sesión — 2026-09-09 — Auditoría ventas e inventario (descuadre físico vs sistema)

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-09-09 |
| Sprint | — (auditoría, fuera de sprint) |
| Agente | Claude Code |
| HUs trabajadas | — |
| Estado | Completada (diagnóstico). Correcciones pendientes de aprobación del dueño. |

---

## 1. Objetivo de la sesión

Auditar los módulos de **ventas** e **inventario** para explicar un síntoma reportado por el dueño:

> "La caja cuadra pero a veces en físico tenemos menos productos que en inventario.
> Sucede con los sachets y productos pequeños, que son los que más se venden."

Alcance: código (`features/sales`, `features/inventory`, `features/pos`), RPCs y triggers en
producción, y datos reales del proyecto remoto `rmaieqyscchtxxkgxgik`.

**Nota metodológica:** todo se verificó contra el **remoto** con
`supabase db query --linked --file` (ver [[project-supabase-remote-access]]), no contra las
migraciones locales — hay drift conocido entre ambos.

---

## 2. Diagnóstico

### 2.0 Por qué la caja cuadra y el inventario no

Son dos libros distintos y solo uno está completo. `create_sale_atomic` calcula el precio en el
servidor y persiste `payments` correctamente → **el dinero siempre cuadra**. El descuento de stock,
en cambio, es *condicional*: depende del `tipo` del producto y de si tiene componentes/opción
configurados. Cuando esa configuración falta, la venta se cobra pero **no genera ningún movimiento
de inventario**. El sistema queda con más unidades de las que hay en la estantería.

Eso es exactamente el síntoma: caja OK, físico < sistema, y concentrado en lo que más rota.

**Lo que SÍ está bien** (verificado, para no tocarlo):
- Conciliación venta ↔ `inventory_movements`: cuadra. Solo 9 unidades de VASO 9onz descuadran, y
  es porque el componente se configuró *después* de esas ventas, no por un bug.
- `void_sale_atomic` revierte de forma simétrica: producto propio, componentes y componente de opción.
- Idempotencia de venta (`idempotency_key`) funciona; la llave se genera al iniciar el carrito.
- `pg_advisory_xact_lock` por producto evita carreras de sobreventa.
- Hoy **no hay stock negativo** en ningún producto.

---

### H1 — CRÍTICO — La proteína del batido no descuenta nada

**Qué pasa.** La opción `CH+` de `BATIDO EN LECHE` / `BATIDO EN AGUA` tiene
`componente_id = NULL`. `tg_consume_sale_components` solo descuenta si la opción tiene componente,
así que un batido CH+ **no mueve una sola unidad de inventario**.

**Cuánto.** De 493 batidos vendidos:

| Opción registrada | Unidades | ¿Descuenta? |
|---|---|---|
| CH+ (explícita) | 158 | ❌ nada |
| Sin opción → el servidor aplica CH+ por defecto | 324 | ❌ nada |
| Bipro | 7 | ✅ 1 sachet |
| Best Whey | 4 | ✅ 1 sachet |

**482 batidos (97,8%) no descontaron proteína.**

**Y sí existe el producto para descontarla.** `SERVICIO - SACHET DE PROTEINA CH+` se creó el
2026-07-02 con 100 unidades de inventario inicial. Desde entonces solo salieron **8** (ventas
directas del sachet). Quedan **92 en el sistema** que físicamente ya se usaron en batidos.

En paralelo, los tarros se abren a mano: `ISO CH+ 2LB` tiene 7 ajustes de `-1` con motivos
"Abrir para proteina de batidos", "Se abrio el pote para las proteinas", "apertura". Esa salida
del tarro **nunca se conecta** con la entrada de sachets ni con el consumo del batido.

> Esta es, sola, la mayor fuga y explica el síntoma tal como lo describe el dueño.

---

### H2 — CRÍTICO — 18 productos `prepared` sin componentes venden sin descontar nada

`create_sale_atomic` salta el chequeo de stock y el `sale_exit` para `tipo in ('prepared','combo')`,
delegando en el trigger de componentes. Si el producto **no tiene componentes**, no pasa nada en
ninguna de las dos ramas: se cobra y el inventario ni se entera.

**359 unidades vendidas con cero impacto en inventario:**

| Producto | Uds vendidas |
|---|---|
| BANANO 80GR | 110 |
| Agua | 70 |
| ARANDANOS | 44 |
| FRESA 90GR | 29 |
| CAFE 7GR | 19 |
| MORA 80GR | 15 |
| MANGO 150GR / MANTEQUILLA MANI 30GR | 11 c/u |
| CHIPS CHOCOLATE / GRANOLA / MILO 30GR / PIÑA 110GR | 8 c/u |
| SALSA CHOCOLATE | 7 |
| AREQUIPE 50GR / CAFE ESPRESO 7GR | 4 c/u |
| SALSA FRESA / CARAMELO / NUTRA POPS + LECHE | 1 c/u |

Dos matices importantes:
- La mayoría son **toppings porcionados de un granel que no está modelado** (no hay producto
  "bolsa de banano"). Ahí no hay unidad física que descuadre — es un hueco de costeo, no de stock.
- **`Agua` sí descuadra.** Tiene 28 `sale_exit` antiguos (era `simple`) y 70 ventas. Si es agua
  embotellada, cada venta desde que pasó a `prepared` es una botella que sale y el sistema no ve.
- `NUTRA POPS + LECHE` se vende sin descontar `CEREAL NUTRAPOPS`, que sí existe como producto.

---

### H3 — ALTO — La conversión tarro → sachets es manual, estimada y sin control

No existe una operación de "apertura de tarro". Se hace con dos ajustes sueltos y a ojo:

```
2026-07-08  PSYCHOTIC ROJO 60 SERV     adjustment  -1   "Apertura para sachets"
2026-07-08  PSYCHOTIC SACHET           adjustment  +58  "entrada por apertura de tarro"
```

Entradas de sachets registradas como `adjustment` (no como `entry`, no atadas a la salida del tarro):
INTENZE FRUIT PUNCH **+89**, PASE BLUE RASPBERRY **+64**, PSYCHOTIC **+49**, INTENZE CITRUS **+30**,
BIPRO CLASSIC **+20**.

El número sale del rótulo del tarro ("60 SERV"), no de contar los sachets llenados. Si el scoop real
rinde menos —lo normal—, **el sistema queda inflado desde el momento de la apertura**. En total hay
**109 ajustes manuales por 620 unidades**, casi todos en sachets y productos pequeños.

---

### H4 — ALTO — La opción por defecto se aplica en silencio

`pos.page.ts:1263` — `selectProduct()` mete el batido al carrito con la opción `es_default` (CH+)
sin preguntar nada. Cambiarla exige que el cajero se acuerde de tocar la línea del carrito y elegir
otra. Comentario en el código: *"Vender es un toque… cambiarla es la excepción"*.

Consecuencia: si el cajero prepara el batido con un sachet Bipro pero no cambia la opción, se vende
como CH+ y el sachet Bipro no se descuenta. En ~3 meses solo **11 unidades** quedaron registradas
con sachet. La probabilidad de que ese sea el consumo real es baja.

---

### H5 — ALTO — No existe conteo físico; solo ajustes por delta escritos a mano

El diálogo de ajuste (`adjust-stock.dialog.ts`) pide **"Variación (+ entrada / − salida)"**. El
operario ve el stock del sistema, cuenta lo físico y tiene que **restar mentalmente** para escribir
el delta. No hay modo "conteo": *"hay 14 unidades"* → el sistema calcula el ajuste.

Los propios motivos guardados en producción muestran el costo de eso:

```
"error conteo"  ·  "Error de conteo"  ·  "me equivoque"  ·  "estaba equivocado"
"Reversa de dos ajustes -3 duplicados del 2026-07-21"
"porque este pograma es una mie..."
```

Y hay **duplicados confirmados** — el operario reenvió porque no vio confirmación:

```
VASO MOVEON 16onz  -47  22:52:08   |  GALLETA OREO  -3  23:53:02
VASO MOVEON 16onz  -47  22:52:26   |  GALLETA OREO  -3  23:54:07
```

No es una condición de carrera (el diálogo tiene guard `saving()`): son envíos separados por 18–65
segundos. Faltan idempotencia, aviso de "ya hiciste un ajuste idéntico hace un momento" y
confirmación visible del stock resultante.

---

### H6 — ALTO (integridad/seguridad) — El kardex y las ventas se pueden editar y borrar desde el cliente

En producción:

```
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE  ON inventory_movements, sales, sale_items
  TO authenticated, anon;

POLICY tenant_isolation  FOR ALL  USING (tienda_id IN (SELECT get_user_tiendas()))   -- sin WITH CHECK
```

Cualquier usuario autenticado (incluido un cajero) puede hacer `PATCH`/`DELETE` directo por
PostgREST sobre `inventory_movements` y `sales` de su tienda. Esto rompe dos principios no
negociables del proyecto: *"el stock nunca se modifica directamente"* y *"las ventas no se borran
físicamente"*. `tr_audit_inventory_adjustment` solo audita `AFTER INSERT`: un `UPDATE` o `DELETE`
no deja rastro alguno.

Los grants a `anon` hoy no son explotables (RLS lo corta porque `get_user_tiendas()` va vacío), pero
no deberían existir.

**No hay evidencia de que esto se haya usado** — la conciliación venta ↔ movimientos cuadra. Es
riesgo latente, no causa del descuadre actual.

---

### H7 — MEDIO — Vender preparados/combos sin componentes no avisa nada

La política documentada es "advertir, no bloquear" (ADR 0017 §2.4), pero **no se advierte**:
`stockDisponible = null` para `prepared` → `capQuantity` no topa y el badge dice "Bajo pedido".
Se puede vender 20 batidos con 3 vasos en stock y el vaso se va a negativo sin que nadie lo note
en el momento.

---

### H8 — MEDIO — Cambiar `productos.tipo` reescribe la semántica del histórico

`Agua` y `CAFE ESPRESO 7GR` conservan `sale_exit` de cuando eran `simple`, y sus ventas posteriores
no tienen movimiento. El kardex deja de ser reconstruible hacia atrás y no queda registro de cuándo
ni por qué cambió el tipo.

---

### H9 — MEDIO — Deriva entre el repo y producción (riesgo de despliegue)

`register_inventory_entry_atomic` y `correct_inventory_entry_cost_atomic` **no existen en el remoto**
(migración `20260814000100`, aún sin commitear). Pero el working tree de
`data/repositories/inventory.repository.ts` **ya los llama**. Si ese código se despliega sin aplicar
la migración, **el registro de entradas de inventario deja de funcionar en producción**.
También falta en el remoto `correct_sale_customer_atomic` (`20260723010000`).

---

### H10 — BAJO — `create_sale_atomic` no filtra `deleted_at`

Valida `is_active` pero no el borrado lógico. Un producto con `deleted_at` e `is_active = true`
seguiría siendo vendible.

---

## 3. Correcciones propuestas (pendientes de aprobación)

| # | Corrige | Acción | Riesgo |
|---|---|---|---|
| 1 | H1 | Enlazar la opción `CH+` → componente `SERVICIO - SACHET DE PROTEINA CH+`, cantidad 1 (2 filas de `product_options`) | Bajo, reversible |
| 2 | H1 | Ajuste de conteo físico sobre los 92 sachets CH+ para partir de la realidad | Requiere conteo del dueño |
| 3 | H2 | Decidir producto por producto: modelar el granel y dar componente, o pasar a `simple` con stock (caso `Agua` y `NUTRA POPS + LECHE`) | Requiere decisión de negocio |
| 4 | H4 | Al agregar un producto con opciones, **abrir el selector** en vez de aplicar el default en silencio | Un toque más por batido |
| 5 | H5 | Modo **conteo físico** en el diálogo: se escribe el conteo real, el sistema calcula el delta y lo muestra antes de guardar | Bajo |
| 6 | H5 | Idempotencia en el ajuste + aviso de ajuste idéntico reciente | Bajo |
| 7 | H3 | RPC `open_container_atomic(tarro, sachets_obtenidos)`: una transacción, salida del tarro + entrada de sachets, contando los llenados | Medio |
| 8 | H6 | `REVOKE UPDATE, DELETE, TRUNCATE ... FROM authenticated, anon` en `inventory_movements`, `sales`, `sale_items`; revocar todo a `anon`; políticas por comando con `WITH CHECK` | Verificar que ningún flujo dependa de un UPDATE directo |
| 9 | H7 | Mostrar en el POS la disponibilidad derivada de componentes para preparados (ya existe `deriveComboStock`, se puede reutilizar) | Bajo |
| 10 | H9 | Aplicar `20260814000100` al remoto **antes** de desplegar el working tree de inventario | Debe ir primero |

**Orden recomendado por impacto/esfuerzo:** 1 → 5 → 4 → 8 → 2 → 3 → 10 → 9 → 6 → 7.

---

## 4. ADRs creados o actualizados

Ninguno todavía. Las correcciones 7 (apertura de contenedor) y 9 (disponibilidad de preparados)
merecen ADR antes de implementarse.

---

## 4.bis Cambio aplicado — desbloquear componentes de preparados (parte de H2)

**Pregunta del dueño:** *"Hay un producto que se llama NUTRA POPS + LECHE, ¿cómo hago para que eso
descuente un CEREAL NUTRAPOPS?"*

**El bloqueo no estaba en la base de datos.** `product_components` no restringe el tipo del
componente y `tg_consume_sale_components` descuenta cualquier `componente_id`. El problema era el
formulario: `filterComponentCandidates` solo ofrecía productos `tipo === 'ingredient'`, y en la
tienda solo hay dos (VASO MOVEON 9onz y 16onz). `CEREAL NUTRAPOPS` es `simple` (se vende suelto a
$7.000, 13 unidades en stock), así que **nunca aparecía en el desplegable**.

Era además una incoherencia interna: el filtro de componentes de una **opción** de venta
(`filterOptionComponentCandidates`) y el de **combos** (`filterComboItemCandidates`) ya aceptaban
cualquier producto con stock propio, con este mismo razonamiento en el comentario:
*"aquí sí valen los `simple`: la proteína de un batido sale de un sachet que también se vende suelto"*.

**Cambio:** `filterComponentCandidates` pasa de `p.tipo === 'ingredient'` a `tracksOwnStock(p.tipo)`
— mismo criterio que los otros dos filtros. Excluye `prepared` y `combo`, que no rastrean stock
propio.

Archivos:
- `features/products/presentation/services/product-component.helpers.ts` — filtro + comentario
  (y se actualizó el comentario ya obsoleto de `filterOptionComponentCandidates`).
- `tests/unit/features/products/product-components.test.ts` — se reemplazaron los dos casos que
  fijaban el comportamiento viejo (`'no incluye productos simple ni prepared'`,
  `'devuelve lista vacía si no hay ingredientes disponibles'`) y se agregó una regresión explícita
  para el caso Nutra Pops.

Esto habilita la corrección #3 de la tabla de la sección 3 desde la UI, sin tocar datos a mano.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó (All files pass linting)
- [x] `pnpm test` — 722 tests pasaron, 0 fallaron (78 archivos)

---

## 6. Bloqueos y preguntas pendientes

- [ ] **¿Cada batido CH+ consume un sachet porcionado, o se sirve con scoop directo del tarro?**
      De la respuesta depende si la corrección #1 es enlazar el sachet o modelar el tarro por gramos.
- [ ] **¿`Agua` es agua embotellada (producto que se compra por unidad) o agua de la llave?**
      Si es embotellada debe volver a `simple` con stock.
- [ ] **¿Los toppings (BANANO 80GR, GRANOLA, ARANDANOS…) se quieren controlar por inventario?**
      Hoy no lo están y no hay granel modelado.
- [ ] Antes de tocar `product_options` en producción hace falta confirmación explícita del dueño.

---

## 7. Próximos pasos

1. Responder las 3 preguntas de la sección 6.
2. Aplicar la corrección #1 (enlazar CH+ → sachet) y hacer un conteo físico de sachets como punto cero.
3. Implementar el modo conteo físico del diálogo de ajuste (#5) — es lo que más ruido quita día a día.
4. Aplicar `20260814000100` al remoto antes de cualquier despliegue de inventario (#10).
5. Migración de hardening de grants/políticas (#8).

---

## 8. Notas adicionales

- Los `entry` de inventario en producción hoy son **INSERT directo** desde el cliente (versión
  commiteada del repositorio), no RPC. El cambio a RPC está sin commitear. Ver H9.
- El síntoma es de **sub-registro de consumo**, no de robo ni de error de caja: el dinero cuadra
  porque el precio y los pagos los calcula el servidor; el inventario no cuadra porque el consumo
  es condicional a una configuración que falta.
