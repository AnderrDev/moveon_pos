# Módulo: billing (Facturación electrónica)

> Implementación funcional en v1.1. En v1.0 solo se crean las tablas y la interfaz, con `MockBillingAdapter` activo.

---

## Responsabilidad

Orquestar la emisión de documentos electrónicos (factura electrónica o documento equivalente POS) ante la DIAN, vía un proveedor tecnológico autorizado.

**El POS no implementa lógica DIAN directa.** Toda la complejidad fiscal vive en el proveedor.

---

## Interfaz principal

```typescript
// src/modules/billing/domain/billing-provider.interface.ts

export interface BillingProvider {
  issueDocument(input: IssueDocumentInput): Promise<Result<IssueDocumentResult, BillingError>>;
  voidDocument(input: VoidDocumentInput): Promise<Result<void, BillingError>>;
  getDocumentStatus(documentId: string): Promise<Result<DocumentStatus, BillingError>>;
}

export type IssueDocumentInput = {
  saleId: string;
  documentType: 'invoice' | 'pos_document';
  cliente: ClienteFiscal;
  items: BillingItem[];
  totals: BillingTotals;
  paymentMethods: BillingPayment[];
};

export type IssueDocumentResult = {
  documentId: string;       // ID del documento en el proveedor
  documentNumber: string;   // ej: 'FE-1234'
  prefix: string;
  cufeOrCude: string;
  qrUrl: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  issuedAt: Date;
};

export type BillingError =
  | { type: 'ProviderUnreachable'; message: string }
  | { type: 'InvalidClienteData'; field: string; message: string }
  | { type: 'NumberingExhausted'; message: string }
  | { type: 'DianRejected'; code: string; message: string }
  | { type: 'AuthenticationFailed'; message: string }
  | { type: 'Unknown'; message: string };
```

---

## Adapters planeados

### `MockBillingAdapter` (v1.0)
- Para tests y desarrollo local.
- Simula respuesta exitosa con datos falsos.
- Permite probar flujos UI sin consumir folios reales.

### `<Proveedor>BillingAdapter` (v1.1)
- A definir entre Factus, Alegra, Facturatech, Siigo API u otro.
- Selección se documenta en ADR cuando se decida.

### `OwnSoftwareDianAdapter` (futuro, v2+)
- Solo si el negocio crece lo suficiente para justificar habilitación propia.

---

## Flujo de emisión

```
Usuario en POS marca "Solicitar factura electrónica"
    ↓
Captura datos del cliente (NIT/CC, nombre, email)
    ↓
Confirma venta → Server Action `create-sale`
    ↓
Sale creada en estado completed, billing_status = 'pending'
    ↓
Server Action `issue-billing-document` (puede ser síncrono o background)
    ↓
billingProvider.issueDocument(...)
    ↓
Proveedor responde
    ├─ accepted → update billing_documents, billing_status = 'accepted'
    │            update sale.billing_status, guarda PDF/XML, envía al cliente
    │
    ├─ rejected → update billing_documents, billing_status = 'rejected'
    │            notifica admin para corregir y reintentar
    │
    └─ failed (timeout, unreachable) → status = 'failed', programar reintento
```

---

## Reglas de negocio

### RN-B01: Idempotencia por venta
Una venta solo puede tener **un** `billing_document` activo. Si ya existe uno con status `accepted`, no se permite emitir otro.

### RN-B02: Datos del cliente para FE
Para emitir factura electrónica:
- `tipo_documento` y `numero_documento` obligatorios.
- `nombre` obligatorio.
- `email` recomendado (para envío automático).

Para documento equivalente POS, los requisitos pueden ser menores. Se valida según el proveedor.

### RN-B03: Reintentos automáticos
Documentos en status `failed` se reintentan automáticamente con backoff exponencial: 1min, 5min, 15min, 1h, 6h. Después de 5 intentos fallidos, se marca para revisión manual.

### RN-B04: Anulación
Anular una venta con FE aceptada genera una **nota crédito** en el proveedor. No borra el documento original.

### RN-B05: Eventos auditados
Cada llamada al proveedor (request + response) se guarda en `billing_events` para auditoría.

### RN-B06: Sin secretos en cliente
Las credenciales del proveedor nunca pasan por código cliente. Solo Server Actions y Edge Functions las usan.

---

## Use cases

- `IssueBillingDocumentUseCase`
- `RetryFailedBillingDocumentsUseCase` (job programado)
- `GetDocumentStatusUseCase`
- `VoidBillingDocumentUseCase`

---

## Configuración

En `settings.data.billing`:
```json
{
  "provider": "factus",
  "default_document_type": "pos_document",
  "auto_issue_on_request": true,
  "retry_max_attempts": 5,
  "client_data_required_for_invoice": true
}
```

Las credenciales del proveedor están en variables de entorno:
- `BILLING_PROVIDER_API_URL`
- `BILLING_PROVIDER_API_KEY`
- `BILLING_PROVIDER_RESOLUTION_PREFIX`
- `BILLING_PROVIDER_RESOLUTION_NUMBER`

---

## RLS

```sql
CREATE POLICY "read_own_tienda_billing_docs" ON billing_documents
  FOR SELECT USING (
    tienda_id IN (SELECT tienda_id FROM user_tiendas WHERE user_id = auth.uid() AND is_active = true)
  );

-- Inserts y updates: solo desde server con service role.
-- No se exponen al cliente.
```

---

## Testing

- Tests unitarios con `MockBillingAdapter` para todos los escenarios:
  - Emisión exitosa.
  - Rechazo DIAN.
  - Timeout.
  - Cliente con datos incompletos.
  - Idempotencia.
- Tests de integración con sandbox del proveedor real (en v1.1).
- Tests de reintentos (mock con falla intermitente).
