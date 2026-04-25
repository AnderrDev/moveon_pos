# 05 — Glosario

> Términos del dominio. Tanto humanos como agentes IA deben usar este vocabulario consistentemente.

---

## Negocio

| Término | Definición |
|---|---|
| **POS** | Point of Sale. El sistema completo y/o la pantalla principal de venta. |
| **Venta (Sale)** | Transacción comercial entre la tienda y un cliente. Tiene 1 o más productos y 1 o más pagos. |
| **Ítem de venta (Sale Item)** | Línea individual de una venta: producto + cantidad + precio. |
| **Pago (Payment)** | Una porción del total de la venta cubierta con un método de pago. Una venta puede tener varios pagos (pagos mixtos). |
| **Pago mixto** | Cliente paga la venta combinando varios métodos (ej: $50.000 efectivo + $30.000 Nequi). |
| **Producto simple** | Producto vendido tal cual (proteína, creatina, snack). |
| **Producto preparado (`prepared`)** | Producto que se elabora en la tienda (batidos). En v1.0 se trata como simple; en v1.2 tendrá receta. |
| **Ingrediente (`ingredient`)** | Producto usado para preparar otros productos. No se vende solo en general. |
| **Categoría** | Agrupación lógica de productos (proteínas, creatinas, snacks, batidos, etc.). |
| **SKU** | Stock Keeping Unit. Código interno único del producto en la tienda. |
| **Código de barras** | Código del fabricante leído por el scanner. Distinto al SKU. |
| **Stock** | Cantidad disponible de un producto en una tienda específica. Se calcula sumando todos los `inventory_movements`. |
| **Movimiento de inventario** | Registro de cualquier cambio de stock: entrada, salida por venta, ajuste manual, devolución. |
| **Caja (Cash Session)** | Sesión de trabajo de un operador. Se abre con base inicial y se cierra con cuadre. |
| **Apertura de caja** | Inicio de una sesión, registrando dinero inicial físico. |
| **Cierre de caja** | Fin de una sesión, comparando efectivo esperado (calculado) con efectivo real (contado). |
| **Cuadre** | Diferencia entre efectivo esperado y efectivo real al cerrar caja. |
| **Ingreso/egreso manual** | Movimiento de dinero en caja que no es venta (ej: cambio de billete, gasto operativo, retiro del dueño). |
| **Ticket interno** | Comprobante impreso de una venta. **No es documento fiscal.** |
| **Anulación** | Marca una venta como inválida. La venta no se borra; el stock se repone. |

---

## Facturación electrónica (Colombia)

| Término | Definición |
|---|---|
| **DIAN** | Dirección de Impuestos y Aduanas Nacionales de Colombia. |
| **Factura electrónica (FE)** | Documento fiscal validado previamente por la DIAN. Tiene CUFE. |
| **Documento equivalente POS electrónico** | Documento fiscal específico para POS, alternativa a la factura electrónica para operaciones B2C. Tiene CUDE. |
| **CUFE** | Código Único de Factura Electrónica. Identificador único asignado a cada FE validada. |
| **CUDE** | Código Único de Documento Electrónico. Equivalente al CUFE para documentos POS. |
| **Resolución de numeración** | Autorización de la DIAN para emitir documentos en un rango específico (ej: FE-1 a FE-5000). |
| **Prefijo** | Identificador del rango de numeración (ej: "FE", "POS", "SETT"). |
| **Proveedor tecnológico** | Empresa autorizada por la DIAN para validar y firmar documentos electrónicos en nombre del comerciante. |
| **Habilitación** | Proceso por el cual la DIAN autoriza a un comerciante o software a emitir FE. |
| **Sandbox** | Ambiente de pruebas del proveedor de facturación. |

---

## Técnico / Arquitectura

| Término | Definición |
|---|---|
| **Módulo** | Bounded context de negocio. Cada módulo tiene su propia carpeta en `src/modules/`. |
| **Dominio** | Capa con entidades y reglas de negocio puras, sin dependencias de frameworks. |
| **Use case** | Caso de uso. Orquesta lógica del dominio para responder a una acción concreta del usuario. |
| **Repositorio** | Interfaz para persistir/leer entidades. Implementación vive en `infrastructure/`. |
| **Adapter** | Implementación concreta de una interfaz para integrar con un sistema externo. |
| **Server Action** | Función Next.js ejecutada en server, llamable desde componentes cliente. |
| **Edge Function** | Función Supabase que corre cerca de la DB, en infra Deno. |
| **RLS** | Row Level Security. Mecanismo de PostgreSQL para filtrar filas según el usuario autenticado. |
| **Service role** | Llave de Supabase que bypassea RLS. Solo se usa server-side, con extremo cuidado. |
| **Idempotency key** | Identificador único enviado por el cliente para evitar duplicados al reintentar una operación. |
| **PWA** | Progressive Web App. Aplicación web que se comporta como nativa (instalable, offline parcial). |
| **ADR** | Architecture Decision Record. Documento corto que registra una decisión arquitectónica. |
| **HU** | Historia de Usuario. Descripción corta de una funcionalidad desde la perspectiva del usuario. |

---

## Estados que importan recordar

### `sales.status`
- `completed`: venta normal, válida.
- `voided`: venta anulada.

### `sales.billing_status`
- `not_required`: cliente no pidió factura. Default.
- `pending`: factura solicitada, aún no enviada al proveedor.
- `sent`: enviada al proveedor, esperando respuesta.
- `accepted`: aceptada por DIAN.
- `rejected`: rechazada por DIAN.
- `failed`: error técnico (sin respuesta del proveedor).

### `cash_sessions.status`
- `open`: caja abierta, se pueden hacer ventas.
- `closed`: caja cerrada, sesión finalizada.

### `inventory_movements.tipo`
- `entry`: entrada de mercancía (compra a proveedor).
- `sale_exit`: salida por venta (cantidad negativa).
- `adjustment`: ajuste manual (positivo o negativo).
- `void_return`: reposición por anulación de venta.
