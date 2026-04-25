# 01 — Alcance MVP v1.0

> **Regla de oro:** si una funcionalidad no aparece en este documento, **no se construye en v1.0**. Si surge una necesidad nueva, va al backlog post-MVP.

---

## Objetivo único del MVP

**Operar la tienda diariamente sin Siigo**, con la única excepción de las facturas electrónicas reales (que se siguen emitiendo en Siigo en paralelo hasta v1.1, donde se libera la integración con proveedor de facturación).

---

## Qué entra en v1.0

### M1. Autenticación y roles
- Login con email + contraseña (Supabase Auth).
- Roles iniciales: `admin`, `cajero`.
- Cierre de sesión.
- Recuperación de contraseña.

### M2. Catálogo de productos
- CRUD de productos (admin).
- Categorías (proteínas, creatinas, snacks, batidos, etc.).
- Campos: nombre, SKU, código de barras, precio venta, costo, IVA, categoría, tienda_id, activo.
- Tipo de producto: `simple`, `prepared` (batido), `ingredient`.
- Búsqueda por nombre, SKU o código de barras.

### M3. Inventario simple
- Stock por producto y por tienda.
- Movimientos de inventario: `entry`, `sale_exit`, `adjustment`, `void_return`.
- Toda modificación de stock pasa por `inventory_movements`.
- Stock mínimo y alerta visual cuando se cruza.
- Sin lotes, sin vencimientos (no aplica para este negocio).

### M4. Pantalla de venta (POS)
- Búsqueda dual: input inteligente que detecta scanner vs typing manual.
- Carrito con productos y cantidades.
- Edición de cantidades en carrito.
- Descuentos manuales (porcentaje o monto fijo) con permiso por rol.
- Cálculo automático de subtotal, IVA y total.
- Selección de cliente (opcional, para fidelización futura).
- Bloqueo de venta si caja no está abierta.

### M5. Pagos
- Métodos: efectivo, tarjeta, Nequi/Daviplata, transferencia.
- **Pagos mixtos** (cliente paga con varios métodos en una sola venta).
- Registro de referencia para pagos no efectivo (últimos 4 dígitos, número de aprobación, etc.).
- Cálculo de cambio para efectivo.

### M6. Caja
- Apertura de caja con base inicial.
- Una caja abierta por usuario a la vez.
- Registro de ingresos y egresos manuales (con motivo).
- Cierre de caja: efectivo esperado vs. real, diferencia auto-calculada.
- Reporte de cierre imprimible.

### M7. Tickets internos
- Impresión vía navegador (CSS optimizado para 80mm).
- Información: nombre tienda, fecha/hora, productos, totales, método(s) de pago.
- **No es documento fiscal.** Es comprobante interno.

### M8. Reportes básicos
- Ventas del día (totales, por método de pago, por cajero).
- Detalle de ventas con filtros por fecha.
- Reporte de cierre de caja.
- Stock actual con alerta de bajo stock.

### M9. Migración desde Siigo
- Importar productos por CSV (formato definido en `/docs/modules/products.md`).
- Importar clientes por CSV (opcional).
- Stock inicial cargado por CSV o ajuste manual.

### M10. Multi-sede preparado en datos
- Toda tabla operativa lleva `tienda_id`.
- Tabla `tiendas` con datos básicos.
- En v1.0 hay **una sola tienda activa**, pero el modelo lo soporta sin migración futura.
- UI no expone selector de tienda todavía.

---

## Qué NO entra en v1.0

| Funcionalidad | Versión planeada | Justificación |
|---|---|---|
| Facturación electrónica vía API | v1.1 | Sprint dedicado. Hasta entonces, facturas reales se emiten en Siigo en paralelo. |
| Recetas de batidos con modificadores | v1.2 | Volumen bajo de batidos (<5), no es crítico. |
| Fidelización con puntos | v1.3 | Mejora de negocio, no requisito operativo. |
| Reportes avanzados (márgenes, comparativos, top productos) | v1.4 | Requieren histórico de datos primero. |
| Modo contingencia offline | v1.5 | Internet estable, no es prioridad inicial. |
| UI multi-sede (selector, transferencias) | v2.0 | Cuando abran segunda tienda. |
| App móvil nativa | No planeado | PWA cubre el caso. |
| E-commerce | No planeado | Fuera de alcance. |
| Integración con datáfono | No planeado en MVP | Datáfono opera independiente, se registra referencia manual. |
| Vencimientos y lotes | No planeado | Negocio rota rápido, no aplica. |
| Compras a proveedores | No planeado en MVP | Se hace por fuera del sistema. |

---

## Criterios de cierre del MVP v1.0

El MVP se considera **listo para producción** cuando:

- [ ] Todos los módulos M1–M10 están implementados y testeados.
- [ ] Existen tests unitarios para lógica de dominio en `sales`, `inventory`, `cash-register`.
- [ ] Existen tests de integración para los flujos: crear venta, cerrar caja, ajustar inventario.
- [ ] RLS está activado y probado en todas las tablas con datos del negocio.
- [ ] Se realizó una sesión de pruebas con datos reales (al menos 50 ventas simuladas).
- [ ] La importación CSV de productos desde Siigo funciona con el archivo real.
- [ ] El operador (dueño) puede hacer una venta completa en menos de 30 segundos.
- [ ] La documentación en `/docs/modules/` está actualizada.
- [ ] Existe un manual operativo básico para el día 1 de uso real.

---

## Plazo realista

- **Full-time (8h/día):** 6–8 semanas.
- **Part-time (3–4h/día):** 3–4 meses.

Si el desarrollador no puede comprometer al menos 4h/día consistentemente, **se debe ajustar este scope hacia abajo** (eliminar M9 y reducir M8 a solo "ventas del día").

---

## Reglas para cambios de scope

1. Cualquier funcionalidad nueva propuesta durante el desarrollo va al **backlog post-MVP**, no al MVP.
2. Si una funcionalidad listada aquí se demuestra demasiado costosa, se puede mover al post-MVP **con justificación documentada**.
3. Las decisiones de scope las toma el dueño del producto (en este caso, el dueño del negocio).
