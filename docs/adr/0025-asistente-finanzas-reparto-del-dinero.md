# ADR 0025 — Asistente de finanzas: reparto del dinero en sobres (desde noviembre 2026)

**Estado:** Aceptado (aprobado por el dueño el 2026-11-01). **Enmienda del mismo día:** el dueño pidió quitar el sobre de fijos apartado por día ("la idea es solo separar la plata del inventario de la utilidad"). Quedan tres sobres: mercancía, gastos (lo registrado, sin apartar por adelantado) y utilidad. Las secciones §1–§2 describen el diseño original; `docs/modules/expenses.md` tiene el vigente.

## Contexto

### Lo que dice el dueño (2026-11-01)

> "No entiendo nada de ese módulo. Estamos gastando dinero sin tener en cuenta qué es de qué.
> Necesito que me diga qué debo reinvertir, separando la plata de la utilidad de la del inventario.
> Que arranque en noviembre: los meses pasados están demasiado desordenados."

### Lo que muestra la base de datos de producción (lectura del 2026-11-01)

Cifras redondeadas en millones de pesos. "Costo de lo vendido" sale de `sale_items.unit_cost`;
"compras" son entradas de inventario con costo (incluye stock inicial de productos nuevos).

| Mes | Vendiste | Costo de lo vendido | Gastos registrados | Compras de mercancía |
|---|---|---|---|---|
| Junio | 7,7 | 4,4 | 2,4 | 5,1 |
| Julio | 16,7 | 9,7 | 3,7 | 7,7 |
| Agosto | 12,0 | 6,9 | 2,6 (sin arriendo) | 8,6 |
| Septiembre | 13,8 | 8,0 | 0,6 (sin arriendo ni nómina) | 18,4 |
| Octubre | 14,3 | 7,8 | 4,8 | 7,4 |

Lo que se desprende:

1. **Un mes típico (julio–octubre):** vendes ≈ $14 M; la mercancía vendida costó ≈ $8 M (57 %);
   arriendo + nómina son $4,3 M (30 %); gastos de caja ≈ $0,6 M (4 %). **Ganancia real ≈ $1,2 M
   al mes (≈ 9 %)**, no los $3–4 M que parecen quedar cuando no se registran los fijos.
2. **Compraste más mercancía de la que vendiste.** Junio–octubre: $47,3 M en compras contra
   $36,9 M de costo vendido. Esa diferencia ($10,4 M) no se perdió: está en la estantería.
   El inventario vale hoy **$20,6 M al costo** (≈ $32,8 M a precio de venta), que son
   **≈ 76 días de venta**. Ahí está la plata que "no aparece".
3. **El 70 % de lo que entra es por transferencia** (va al banco) y el 30 % en efectivo (queda en
   la caja). Nada registra qué parte de ese dinero es para reponer mercancía, cuál para el
   arriendo y cuál es utilidad, así que se gasta de la misma bolsa.
4. **Las salidas del dueño no existen en el sistema.** En los cierres de caja el efectivo se deja
   casi entero en el cajón (retiros de cierre: $0 hasta agosto, $0,7 M en septiembre, $2,5 M en
   octubre) y las compras de mercancía casi nunca dicen con qué plata se pagaron (5 entradas con
   método de pago en todo el historial). No hay forma de saber cuánto se ha tomado de utilidad.
5. **El histórico de gastos está incompleto:** falta el arriendo de agosto y septiembre, la nómina
   de septiembre, y la de julio quedó en $900 mil. Por eso la comparativa de 6 meses miente.
6. **El fondo de reinversión arrancó el 2026-10-24 en $0** y hoy se lee como "invertido en
   inventario de más", en ámbar. Es contabilidad correcta pero no dice qué hacer.

### Por qué `/finanzas` no se entiende

- La página son **seis tarjetas de contabilidad** (resumen, fijos, fondo, nómina, gastos,
  comparativa) y ninguna responde las tres preguntas del dueño: *¿cuánto puedo comprar?,
  ¿cuánto puedo sacar?, ¿voy bien o mal?*
- El fondo usa palabras de contador ("apartado", "invertido acumulado", "saldo negativo no es
  deuda") en vez de una instrucción.
- Mezcla **resultado** (ganancia del mes) con **dinero** (lo que hay para gastar). La ganancia
  puede ser positiva y aun así no haber con qué pagar el arriendo porque la plata se fue en
  mercancía.
- Los datos incompletos hacen que cada tarjeta diga un número distinto para el mismo mes.

## Decisión

Agregar a `/finanzas` un **asistente de reparto del dinero** ("Tu plata este mes") que divide todo
lo que entra en **cuatro sobres** y le dice al dueño, en frases, cuánto puede comprar y cuánto puede
retirar. Arranca el **1 de noviembre de 2026**; nada anterior entra en las cuentas del asistente.

### 1. Los cuatro sobres

Cada peso que entra por ventas cobradas (sin el recargo de tarjeta, que es de Nequi) se reparte así,
en este orden:

| Sobre | Cuánto se aparta | De dónde sale el dato |
|---|---|---|
| **Mercancía** (reponer lo vendido) | Exactamente el costo de lo que se vendió | `sale_items.unit_cost` (ya existe: es el fondo de reinversión) |
| **Fijos** (arriendo + nómina) | El total del mes repartido por día: `fijos_del_mes ÷ días del mes × días transcurridos` | Plantillas activas + salario de empleados activos (`buildFixedCommitments`, ya existe) |
| **Gastos del día a día** | Lo que de verdad se gastó (caja, insumos, transporte…) | `expenses` activos del mes que no sean arriendo ni nómina |
| **Utilidad** (lo del dueño) | Lo que sobra | Entradas − los tres sobres anteriores |

Reglas:

- **Los sobres arrastran saldo entre meses** desde la fecha de inicio (igual que hoy el fondo).
  Lo que no se gastó de un sobre sigue en ese sobre.
- **Cada sobre tiene usos registrados:** mercancía → compras (entradas de inventario con costo,
  incluido el stock inicial de productos nuevos, porque es plata que salió); fijos → gastos de
  arriendo y nómina; utilidad → **retiros del dueño** (nuevo, ver §3).
- **Disponible de un sobre = apartado acumulado − usado acumulado (+ saldo inicial).** Si queda en
  negativo, el asistente lo dice en palabras: "Sacaste $X de más: salieron de la plata de la
  mercancía".
- Si el dueño quiere apartar más o menos utilidad no se cambia la fórmula: se cambia el **saldo
  inicial** de cada sobre el 1 de noviembre (p. ej. "arranco con $2 M guardados para mercancía").

### 2. Las frases del asistente (qué debe decir)

El asistente produce **consejos tipados** en dominio (código + cifras) y la presentación los convierte
en frases. Los consejos del primer entregable:

1. **Puedes comprar hasta $A** (sobre mercancía disponible). Si es negativo: "Compraste $A más de lo
   que llevas vendido al costo; no compres hasta recuperarlo".
2. **Puedes retirar hasta $B** (sobre utilidad disponible). Si es negativo: "Retiraste $B de más;
   ese dinero era de mercancía/arriendo".
3. **Guarda $C para arriendo y nómina** (sobre fijos apartado − pagado), con la fecha en que se
   completa la reserva.
4. **Semáforo de inventario:** `días de inventario = inventario al costo ÷ costo vendido por día
   (últimos 28 días)`. Meta configurable por tienda (por defecto **45 días**; hoy ≈ 76).
   - Verde (≤ meta): "Repón lo que vendes: compra hasta $A".
   - Ámbar (entre meta y 1,5 × meta): "Tienes mercancía para N días. Compra solo lo que la lista
     de compras marque como faltante".
   - Rojo (> 1,5 × meta): "Tienes mercancía de sobra (N días). Este mes no compres; deja que el
     sobre de mercancía acumule".
   Este semáforo **no cambia** el tamaño del sobre (lo vendido al costo siempre se aparta); solo
   cambia la recomendación de cuánto usar. Así la plata de mercancía nunca se mezcla con utilidad.
5. **Avisos de datos:** productos vendidos sin costo, entradas sin costo, fijos sin plantilla y
   meses sin arriendo/nómina registrados (los mismos avisos que hoy, concentrados en un solo sitio).

### 3. Retiros del dueño (dato nuevo)

Sin registrar lo que el dueño toma no hay forma de saber si se pasó. Se crea:

- Tabla `owner_withdrawals` (`tienda_id`, `monto`, `fecha`, `origen` = `caja` | `banco`, `nota`,
  `cash_movement_id`, `status` + anulación auditada, `idempotency_key`, `created_by`). RLS solo
  admin; sin escritura directa (solo RPC), como `expenses`.
- RPC `register_owner_withdrawal_atomic`: si `origen = caja` exige caja abierta y crea el
  `cash_movement` tipo `cash_out` con motivo "Retiro de utilidad" en la misma transacción. RPC
  `void_owner_withdrawal_atomic` simétrica (anula también la salida de caja).
- **No es un gasto.** No resta de la ganancia; resta del sobre de utilidad.
- Segundo paso (PLAN-109): el diálogo de cierre de caja pregunta a qué va el retiro de cierre
  (utilidad del dueño / comprar mercancía / consignar al banco) y crea el retiro solo.

### 4. Qué se reutiliza y qué cambia

- **El fondo de reinversión ES el sobre de mercancía.** Se reutilizan `reinvestment_fund_settings`
  (`fecha_inicio` → 2026-11-01, `saldo_inicial` → lo que el dueño decida) y
  `get_reinvestment_fund_totals`. Se agregan a esa tabla `saldo_inicial_utilidad`,
  `saldo_inicial_fijos` y `dias_inventario_meta` (default 45). La tarjeta actual del fondo se
  retira de la página; sus cifras quedan como detalle "ver cuentas" dentro del asistente.
- **Nada cambia en la ganancia del mes** (`buildFinancialSummary`): sigue siendo
  ventas − costo de lo vendido − gastos. El asistente es la vista de **dinero**; el resumen es la
  vista de **resultado**. La página las separa con títulos: "Tu plata" y "Tu resultado".
- Dominio puro nuevo en `features/expenses/domain/services/`: `money-envelopes.ts`
  (`buildMoneyEnvelopes`) y `finance-advice.ts` (`buildFinanceAdvice`, consejos tipados), con tests.
  Sin Angular, sin Supabase, sin texto de UI.
- Nueva tarjeta `mo-finance-assistant` (presentación) arriba del todo en `/finanzas`.
- App iOS: `owner_finance_summary` devuelve además `sobres` y `consejos` para que el celular muestre
  lo mismo (ADR 0021 §4). Se hace después del web.

### 5. Arranque limpio el 1 de noviembre (tareas del dueño)

1. En "Editar fondo": fecha de inicio **2026-11-01** y saldo inicial de mercancía (dinero que ya
   tienes guardado para surtir; si no hay, $0).
2. Decidir saldo inicial de utilidad (normalmente $0) y de fijos (si ya hay plata apartada para el
   arriendo de noviembre).
3. Registrar **cada** compra de mercancía como entrada con costo y método de pago, y cada retiro con
   el diálogo nuevo. Sin esto el asistente no sirve.
4. Registrar arriendo y nómina de noviembre el día que se paguen (plantilla + "Pagar nómina").
5. Opcional, para que la comparativa de 6 meses deje de mentir: registrar arriendo de agosto y
   septiembre y la nómina de septiembre con su fecha real. No afecta al asistente.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Porcentajes fijos por venta (p. ej. 55 % mercancía, 30 % fijos, 15 % utilidad) | Ya tenemos el costo exacto de cada venta; un % se desvía cuando cambia la mezcla de productos (batidos vs. creatina) |
| Conciliación bancaria completa (saldo de banco + caja) | Es el problema de fondo, pero exige registrar cada movimiento bancario. Queda como PLAN-111 después de que los sobres funcionen un mes |
| Modelo de IA que "recomiende" cuánto comprar | Las reglas son tres y explicables; el asesor de compras ya pronostica por producto. No se justifica |
| Reescribir `/finanzas` desde cero | El resultado del mes y los gastos ya cuadran (2026-10-24/26); el hueco es la vista de dinero, no la de resultado |

## Consecuencias

- El dueño ve tres frases al abrir Finanzas: cuánto puede comprar, cuánto puede retirar y si tiene
  inventario de más. Todo lo demás queda debajo o a un clic.
- Aparece una obligación nueva: registrar retiros. Si no se registran, el sobre de utilidad siempre
  dirá "puedes retirar" y no servirá; el cierre de caja (PLAN-109) reduce esa fricción.
- Migración nueva (tabla + 2 RPC + 3 columnas). Pruebas en Supabase local; producción con OK del
  dueño ([[feedback-migrations]]).
- La paridad con la app iOS se mantiene por RPC (PLAN-110), no copiando reglas en Swift.
