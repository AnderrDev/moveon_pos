# 00 — Visión del proyecto

## Por qué existe

MOVEONAPP es una tienda física en Colombia que vende suplementos y batidos para gimnasio. Hoy operan con **Siigo**, cuyo costo anual es alto en relación al volumen del negocio. Construir un POS propio les permite:

1. **Reducir costos** operativos a largo plazo (objetivo principal).
2. **Tener control total** del sistema y los datos.
3. **Personalizar** flujos específicos del negocio (recetas de batidos, fidelización propia).
4. **Escalar** a múltiples sedes sin pagar licencias adicionales por sede o usuario.

## Contexto operativo

| Dimensión | Valor actual |
|---|---|
| Sedes | 1 (con planes de expansión) |
| Ventas/día | 50–100 |
| Operadores simultáneos | 1 |
| Productos en catálogo | < 50 |
| Batidos en menú | < 5, personalizables |
| Vencimientos | No críticos (rotación rápida) |
| Internet | Estable, con plan de contingencia |
| Métodos de pago | Efectivo, tarjeta, Nequi/Daviplata, transferencia, mixtos |
| Factura electrónica | Solo cuando el cliente la pide |

## Decisiones estratégicas tomadas

Estas decisiones están cerradas. Cualquier cambio requiere un ADR formal.

1. **Construir POS propio**, no adaptar uno open source.
2. **No construir integración DIAN directa.** Usar proveedor autorizado vía API en MVP. El POS expone una interfaz `BillingProvider` con patrón Adapter.
3. **Facturación electrónica opcional por venta.** La gran mayoría de ventas cierra con ticket interno.
4. **MVP mínimo primero.** Apagar Siigo lo antes posible. Funcionalidades avanzadas (fidelización, reportes complejos, recetas con modificadores) van en versiones siguientes.
5. **Stack Supabase** para reducir costos de infraestructura y simplificar operación.
6. **Multi-sede preparado en datos** (`tienda_id` en todas las tablas operativas), aunque la UI multi-sede llega después.
7. **PWA responsive** para funcionar en computador, laptop o tablet.
8. **Modo contingencia simple, no offline-first completo.**
9. **Next.js full-stack monorepo** con TypeScript estricto.

## Riesgo principal asumido

El usuario decidió manejar el tema fiscal/DIAN sin contador propio, aprendiendo por su cuenta. Mitigación arquitectónica:
- El proveedor de facturación es quien tiene la habilitación DIAN; el POS solo orquesta.
- Se recomienda **una consulta puntual con un contador antes del lanzamiento** para validar configuración inicial (resolución, IVA por producto, tipos de documento).

## No-objetivos del proyecto

Estas cosas **no** son objetivos del POS, al menos no en el MVP:
- No es un ERP completo. No reemplaza contabilidad ni nómina.
- No es un e-commerce. Solo venta presencial.
- No es un CRM avanzado. Maneja clientes para fidelización básica.
- No es un sistema multi-empresa. Es para MOVEONAPP únicamente.

## Métricas de éxito del MVP v1.0

El MVP se considera exitoso cuando:
- [ ] Se pueden registrar 50–100 ventas/día sin fricción notable.
- [ ] La caja cuadra al cierre con diferencia menor a $5.000 COP por error humano.
- [ ] El stock del sistema coincide con conteo físico tras una semana de operación.
- [ ] El costo mensual de infraestructura es < 15% del costo mensual actual de Siigo.
- [ ] El operador puede hacer una venta completa en menos de 30 segundos.
