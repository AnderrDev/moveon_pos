# ADR 0022 — App iOS "MOVE ON Admin": ventas, inventario y productos desde el iPhone

**Fecha:** 2026-10-24
**Estado:** Aceptado (aprobado por el dueño el 2026-10-24)
**Decisor:** Dueño del producto
**Enmendado:** 2026-10-24 §6 (punto de venta completo, aceptado por el dueño el 2026-10-24)
**Modifica:** ADR 0021 §1 ("v1 de solo lectura", nombre "MOVE ON Dueño", "un POS móvil queda fuera de alcance")

## Contexto

La app iOS del ADR 0021 llegó a PLAN-83 como app de solo consulta: resumen, ventas, caja, stock y finanzas, todo verificado contra el Supabase local. El 2026-10-24, durante PLAN-84, el dueño pidió dos cambios:

1. La app debe decir **"Admin"**, no "Dueño".
2. Debe servir también para **gestionar inventario y ventas**. Estas son las respuestas del dueño:
   - **Ventas:** registrar ventas y anularlas.
   - **Inventario:** entradas de mercancía, ajustes de stock y traslados.
   - **Productos:** crear y editar.
   - **Orden:** las escrituras van antes de publicar (PLAN-84 queda para el final).

Lo que se encontró en el código y la base local el mismo día:

- **Todas esas escrituras ya existen en el servidor como RPC atómicas** y son las que usa el web:
  - `create_sale_atomic` y `void_sale_atomic`;
  - `register_inventory_entry_atomic`, `adjust_stock_atomic` y `transfer_stock_atomic`;
  - `create_product_with_initial_stock`, `save_product_options_atomic` y `save_product_components_atomic`.

  Validan sesión, rol, tienda, cantidades y stock, y escriben el movimiento de inventario y la auditoría.
- **`create_sale_atomic` recalcula la venta en el servidor.** Toma el precio de `productos.precio_venta` y calcula los descuentos (con sus límites), el IVA, el canje del Club, el número de venta y la validación de pagos y cambio. Los totales y el número que manda el cliente se ignoran (`perform p_subtotal, …`). La idempotencia es por `p_idempotency_key`.
  - Exige una **caja abierta** de la tienda (`p_cash_session_id`) y que `p_cashier_id = auth.uid()`.
- **Editar un producto** en el web es un `update` directo sobre `productos` (RLS solo admin, auditoría de precio por trigger `tg_audit_producto_price`). No hay RPC.

## Decisión

### 1. Producto

- **Nombre:** "MOVE ON Admin" en la app. Bajo el ícono se ve "MOVE ON", porque "MOVE ON Admin" se corta.
  - Los identificadores de código no cambian: `MoveOnOwner`, el bundle `co.moveon.owner`, las RPC `owner_*` y el repo `moveon-owner-ios`. Renombrarlos no aporta nada al usuario y rompe historial y firmas.
- **Solo rol `admin`,** como en el ADR 0021.
- **Alcance de escritura de esta versión:**

  | Área | Operación | Cómo escribe |
  |---|---|---|
  | Inventario | Entrada de mercancía (cantidad, costo unitario, ubicación, motivo) | `register_inventory_entry_atomic` |
  | Inventario | Ajuste (cantidad con signo, ubicación, motivo) | `adjust_stock_atomic` |
  | Inventario | Traslado bodega ↔ punto de venta | `transfer_stock_atomic` |
  | Productos | Crear con stock inicial | `create_product_with_initial_stock` |
  | Productos | Editar nombre, SKU, código de barras, categoría, precio, costo, IVA, mínimo, activo | `update` de `productos` (mismo camino y mismos campos que el web) |
  | Ventas | Anular con motivo | `void_sale_atomic` |
  | Ventas | Registrar venta | `create_sale_atomic` |

- **Fuera de esta versión** (siguen en el web): opciones de producto y componentes de combo, imagen del producto, corrección del costo de una entrada, registro de gastos, abrir y cerrar caja, cambios de cliente o de pago de una venta, y descuentos y canje del Club al vender. Cada uno se puede sumar después con su propio PLAN.

### 2. Regla de escritura (complementa ADR 0021 §4)

1. **Toda escritura usa el mismo camino que el web:** la RPC `*_atomic` correspondiente o, para editar un producto, el mismo `update` sobre `productos`. Nunca inserts directos en `sales`, `inventory_movements` ni `cash_movements`. El stock solo cambia por `inventory_movements`, como en todo el sistema.
2. **El servidor es la autoridad.** El dominio Swift valida antes de enviar, con las mismas reglas que los schemas Zod del web (cantidades > 0, motivo obligatorio, ubicaciones distintas en un traslado, precio ≥ 0…). Es para dar mensajes claros, no para proteger los datos. Si el servidor rechaza, el mensaje de su excepción se traduce a español con `UserMessages`, igual que `SupabaseErrorMapper` hoy.
3. **Use-cases de escritura en `Features/<F>/Domain`.** Son funciones o structs con sus dependencias inyectadas que validan y llaman a un protocolo de repositorio; las vistas no llaman a Supabase. Es el equivalente del cableado hexagonal del ADR 0015 §6.3.
4. **Idempotencia en la venta.** La clave (UUID) se genera al abrir el carrito, no en cada toque, y se reutiliza en los reintentos hasta que la venta se confirma. Así un fallo de red con reintento no duplica la venta, como en el web (CLAUDE.md §2.3).
5. **Sin escritura offline.** Sin conexión, el botón de guardar avisa y no encola nada. Una cola offline necesitaría su propio ADR.
6. **Confirmación antes de lo irreversible:** anular, un ajuste negativo y registrar la venta muestran un resumen y piden confirmar.

### 3. Ventas desde el iPhone

- **La venta va a la caja abierta de la tienda.** La app lee el turno abierto (`owner_cash_session_summary` ya lo devuelve). Sin caja abierta, la pantalla de venta lo explica y no deja vender; abrir caja sigue siendo del POS. Que un pago en efectivo hecho desde el iPhone cuente en el esperado de esa caja es correcto: es plata que entra al cajón.
- **Totales:** como en esta versión no hay descuentos ni canje, el total del carrito es Σ precio × cantidad, el mismo cálculo que hace el servidor. El comprobante final muestra lo que devuelve el servidor (número y total), no lo que calculó el teléfono.
- **Pagos:** efectivo (con cambio), transferencia, tarjeta y mixto, con las reglas de pago del web (la suma cubre el total y solo el efectivo da cambio).
- **Productos con opciones y combos:** se venden igual que en el web si el payload lo permite sin lógica extra. Si alguno exige elegir opción, se decide en el PLAN de venta, con el payload del web como referencia.

### 4. Contrato de payloads (calidad)

Las escrituras no tienen la "paridad" de las lecturas, pero corren el riesgo de que el iPhone mande un payload distinto al del web. Por eso cada RPC que use la app tiene un **fixture JSON del payload** en este repo (`tests/integration/fixtures/ios-payloads/`):

- un test de integración del POS lo envía a la RPC en el Supabase local y verifica el efecto (movimiento, stock, venta);
- un test Swift verifica que el use-case produce exactamente ese JSON.

### 5. Lo que no cambia

ADR 0021 §2 (stack), §5 (seguridad: solo anon key, nunca service role), §7 (repo propio, docs aquí), §8 (reglas de `gym_ios`), y las pruebas con datos siempre en el Supabase local.

## Alternativas consideradas

- **Seguir de solo lectura y gestionar todo desde el web.** Se descarta porque el dueño lo pidió explícitamente.
- **RPC nuevas `admin_*` solo para el iPhone.** Se descarta: duplica reglas que ya están probadas en producción y abre la puerta a que el iPhone y el web escriban distinto.
- **Calcular los totales de la venta en Swift y mandarlos.** Se descarta: el servidor ya los ignora y recalcula. Se muestran los del servidor.
- **Una RPC de "cotización" para tener la vista previa con descuentos.** Se pospone: no hace falta mientras la venta del iPhone no tenga descuentos ni canje.

## Consecuencias

### Positivas
- El admin opera la tienda desde el teléfono (recibir mercancía, corregir stock, vender, anular) con las mismas reglas y la misma auditoría que el web.
- No hay SQL nuevo para escribir: el riesgo se concentra en el payload, y lo cubren los fixtures.

### Negativas
- La app deja de ser inofensiva: un error de UX puede crear movimientos reales. Se mitiga con la confirmación, la validación en el dominio y las pruebas siempre en local.
- Más superficie que mantener en sincronía con el web cuando cambie una RPC. Los fixtures lo detectan.
- PLAN-84 (publicar) se mueve al final, después de las escrituras.

### Reglas derivadas
1. Ninguna escritura del iPhone sin una RPC `*_atomic` existente o el mismo `update` del web; si hace falta otra, va en un ADR o en una enmienda.
2. Cada escritura nueva lleva su fixture de payload y su test en ambos repos.
3. Venta del iPhone: idempotencia, caja abierta y comprobante con los datos del servidor.

## 6. Enmienda (2026-10-24): punto de venta completo — **aceptada**

**Contexto.** PLAN-91 entregó un carrito simple (sin descuentos, cliente ni canje, §3). El dueño aclaró que lo que quiere es **el punto de venta del web en el iPhone**: "donde están todos los productos, podemos agregarlos y finiquitar la venta incluido descuento, asociar cliente y esas cosas". Sus respuestas:
- todo lo del POS web: descuentos, asociar cliente, crear cliente y MOVE ON Club;
- búsqueda por texto, sin cámara;
- una pestaña propia "Vender".

**Decisión.** Se reemplaza la limitación de §3 ("sin descuentos ni canje"):

1. **Pestaña "Vender"** en la barra de abajo, que sustituye al botón de carrito de Ventas.
   - Catálogo en cuadrícula, como el web: categorías, búsqueda por nombre, SKU o código de barras escrito, insignias de stock y productos agotados deshabilitados.
   - Combos con sus productos incluidos, opciones editables en el carrito y el carrito siempre visible.
   - El carrito sobrevive al cambio de pestaña.
2. **Descuentos.**
   - Por producto: pesos por unidad, hasta el precio.
   - Global: en pesos o %, hasta el total disponible.
   - Motivo obligatorio (≥ 3 caracteres) para el descuento discrecional.
   - Todo con las reglas de `sale-calculator.ts` del web.
3. **Cliente.**
   - Buscar por nombre, documento o celular entre los clientes no eliminados, y asociarlo a la venta (`p_cliente_id`).
   - Crear cliente desde el cobro con el mismo formulario y validaciones del web (`cliente.dto.ts`). Es el mismo insert del web sobre `clientes`, limitado a las columnas que la base permite al rol (`20261024000500`), y queda auditado.
4. **MOVE ON Club.**
   - Al asociar un cliente se ven sus sellos y recompensas disponibles (`loyalty_accounts` y `loyalty_rewards`, como el web) y los sellos que sumaría la venta.
   - Se puede canjear una recompensa en una línea elegible (`p_loyalty_redemptions`), con las reglas de RN-LF del web.
5. **Totales en el teléfono.** Para saber cuánto cobrar, la app calcula la vista previa con la misma lógica que el web (`sale-calculator.ts`: reparto del global, IVA incluido, canje). Es la única excepción al ADR 0021 §4 ("no se reimplementan reducciones"), y es la misma que ya hace el POS web.
   - El servidor sigue recalculando y validando todo. El comprobante muestra sus cifras.
   - **Paridad:** un test de contrato envía al Supabase local ventas con descuentos de línea, descuento global con reparto, canje y cliente, y compara el total del servidor con la vista previa de Swift, con fixtures compartidos.
6. **Fuera de alcance** (sigue en el web):
   - escáner con la cámara;
   - impresión de tirilla;
   - historial del turno con correcciones de pago o de cliente;
   - abrir y cerrar caja.

**Consecuencias.** Es la pantalla más grande de la app y la que más escribe. Cada parte lleva su contrato de payload y su QA contra el Supabase local antes de seguir con la siguiente (PLAN-92..96).

