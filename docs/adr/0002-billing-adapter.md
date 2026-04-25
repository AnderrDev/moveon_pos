# ADR 0002 — Patrón Adapter para facturación electrónica

**Fecha:** 2026-04-25
**Estado:** Aceptado
**Decisores:** Equipo MOVEONAPP

## Contexto

La facturación electrónica en Colombia es compleja, normativamente cambiante, y representa el mayor riesgo legal del proyecto. Tres caminos posibles:

1. **Software propio habilitado ante DIAN.** Máximo control, máxima complejidad y riesgo.
2. **Servicio gratuito DIAN.** Sin integración API real, operación manual, no sirve para POS.
3. **Proveedor tecnológico vía API** (Factus, Alegra, Facturatech, Siigo API, etc.).

El usuario decidió manejar la parte fiscal sin contador, lo que aumenta el riesgo si asumimos software propio desde el día 1.

## Decisión

Usamos **Proveedor tecnológico autorizado vía API**, encapsulado tras una interfaz `BillingProvider` (patrón Adapter).

```typescript
// src/modules/billing/domain/billing-provider.interface.ts
export interface BillingProvider {
  issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>;
  voidDocument(documentId: string): Promise<Result<void, BillingError>>;
  getDocumentStatus(documentId: string): Promise<Result<BillingStatus, BillingError>>;
}
```

Implementaciones planeadas:
- `MockBillingAdapter` — para tests y desarrollo.
- `<ProveedorReal>BillingAdapter` — el que se contrate en v1.1.

## Consecuencias

### Positivas
- El POS no asume riesgo de habilitación DIAN — el proveedor es quien tiene la habilitación.
- Cambiar de proveedor requiere implementar un nuevo adapter, sin tocar el dominio.
- Posibilidad futura de implementar `OwnSoftwareDianAdapter` si crece el negocio.
- Tests del dominio funcionan con `MockBillingAdapter` sin tocar APIs reales.

### Negativas
- Costo recurrente del proveedor (mensualidad o por folio).
- Dependencia operativa: si el proveedor cae, no podemos facturar.
- Hay que abstraer correctamente la interfaz para que sirva a varios proveedores.

### Reglas derivadas
- El dominio nunca importa código de un proveedor específico.
- La selección del adapter en runtime se hace en `infrastructure/billing/index.ts`, leyendo de configuración.
- Todo error del proveedor se captura y convierte en `BillingError` tipado.
- Los reintentos los maneja un job, no el use case principal.
