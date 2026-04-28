# Módulo: reports (Reportes)

## Responsabilidad
Lecturas agregadas para el negocio. **No tiene reglas de escritura.** Solo consultas optimizadas.

## Reportes MVP v1.0
1. Ventas del día — totales, por método, por cajero.
2. Detalle de ventas con filtros de fecha.
3. Cierre de caja imprimible con ventas esperadas/confirmadas, diferencia total y diferencia de efectivo físico.
4. Stock actual con bajo stock destacado.

## Implementación
- Server Components que consultan vía repositorios.
- Para reportes pesados, considerar vistas materializadas (no en MVP).

## Reportes post-MVP (v1.4)
- Margen y utilidad por producto.
- Top productos / batidos.
- Comparativos por día/semana/mes.
- Productos próximos a quedar sin stock por velocidad de venta.
