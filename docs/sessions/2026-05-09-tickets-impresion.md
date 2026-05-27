# Spec de Sesión — 2026-05-09 — Tickets de venta (M7)

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-05-09 |
| Sprint | Sprint 4+ |
| Agente | Claude Code |
| HUs trabajadas | M7 — Tickets internos |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Implementar M7 del MVP scope: impresión de ticket interno (no fiscal) cada vez que se concrete una venta, con CSS optimizado para impresoras térmicas 80 mm. Disparo automático al cierre de venta + reimpresión desde historial.

---

## 2. Lo que se implementó

### 2.1 Archivos creados
- `apps/pos-angular/src/app/core/tienda/tienda-info.service.ts` — carga `tiendas` + `settings.data.recibo` con cache.
- `apps/pos-angular/src/app/features/pos/receipt-ticket.component.ts` — componente `mo-receipt-ticket` con layout 80 mm: header tienda, items, totales, pagos, cliente, mensaje pie. Inputs: `sale`, `tienda`, `cliente`, `cashierEmail`, `changeOverride`.
- `apps/pos-angular/src/app/features/pos/receipt-print.service.ts` — `ReceiptPrintService.printSale(saleId, { change? })`. Carga venta + tienda + cliente, expone signals al host, dispara `window.print()` y limpia con `afterprint` (fallback timeout 3 s).
- `apps/pos-angular/src/app/features/pos/receipt-print-host.component.ts` — host `mo-receipt-print-host` montado una vez en el shell que escucha al servicio y renderiza el ticket condicionalmente.
- `docs/sessions/2026-05-09-tickets-impresion.md` — este spec.

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/features/sales/sales.repository.ts` — añadido `findById(saleId, tiendaId)` para reimpresión.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` — inyecta `ReceiptPrintService` y, tras `confirmSale()` exitoso, llama `printSale(saleId, { change })`.
- `apps/pos-angular/src/app/features/pos/sales-history.dialog.ts` — botón "Reimprimir" en cada fila junto a "Anular" (también para anuladas).
- `apps/pos-angular/src/app/core/layout/shell.component.ts` — importa `ReceiptPrintHostComponent` y lo monta junto al `ToastHost`.
- `apps/pos-angular/src/styles.css` — bloque `@media print` global con `@page { size: 80mm auto; margin: 0 }` y truco visibility-based para aislar `.receipt-print-area` cuando `body.printing-receipt` está activo.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Auto-imprimir al confirmar venta | Botón "Imprimir" manual en checkout | Reduce fricción del cajero: 1 venta = 1 ticket sin pasos extra. La reimpresión queda disponible en historial. |
| `window.print()` con CSS `@media print` | Iframe oculto con HTML serializado | Reusa el componente Angular sin duplicar template. El iframe sería más aislado pero implica cambios para no perder estilos Tailwind. |
| Truco `visibility:hidden` global + visible en `.receipt-print-area` | Mover el host al `<body>` por DOM | Más simple, no necesita imperatividad; funciona porque el host es nieto del body y `:not()` selectores de hijos directos no aplican. |
| Cliente del recibo cargado por separado en el servicio | Hacer JOIN en `findById` con `clientes` | El JOIN obligaría a relación FK desde `sales` que ya existe pero el repositorio no la trae; cargarlo aparte mantiene el query principal estable. |
| `ReceiptPrintHostComponent` montado en `ShellComponent` | Montarlo solo en `pos.page.ts` | Permite reimprimir desde cualquier ruta (historial puede abrirse desde POS, futuras vistas como reportes). |

---

## 4. ADRs creados o actualizados

Ninguno. El alcance encaja en M7 ya documentado en `01-mvp-scope.md`.

---

## 5. Tests

- [x] `tsc --noEmit -p apps/pos-angular/tsconfig.app.json` — pasó
- [x] `ng build pos-angular --configuration=development` — pasó (3.36 s, 2.33 MB initial)
- [ ] Pruebas manuales en navegador (pendiente del usuario)

---

## 6. Bloqueos y preguntas pendientes

- [ ] **Validación visual real:** falta probar el ticket en una impresora térmica 80 mm (USB / Bluetooth). En desarrollo se valida con "Guardar como PDF" del navegador.
- [ ] **Cliente vacío en historial:** cuando una venta vieja no tenía cliente, el ticket simplemente omite la línea (correcto). Confirmar UX deseado para "Consumidor final" explícito.
- [ ] **Apagar auto-print:** algún operador podría querer desactivarlo. No se implementó toggle en settings — se puede agregar en `settings.data.recibo.auto_imprimir` cuando se solicite.

---

## 7. Próximos pasos

1. Probar en navegador: hacer venta → ver diálogo de impresión → confirmar layout 80 mm.
2. Probar reimpresión desde "Ventas del turno".
3. Si el usuario confirma layout, considerar:
   - Agregar QR de la venta (URL interna a `/ventas/:id`) para reclamación.
   - Logo de la tienda como imagen en `settings.data.recibo.logo_url`.
   - Toggle en settings para desactivar auto-print.

---

## 8. Notas adicionales

- El componente `ReceiptTicketComponent` no es fiscal — explícito en `<p class="receipt-banner">TICKET INTERNO — NO ES DOCUMENTO FISCAL</p>`. Cuando llegue v1.1 (DIAN), se reemplaza el banner y se inyectan CUFE/QR del proveedor desde `billing_documents`.
- El ticket muestra "VENTA ANULADA" en rojo cuando `sale.status === 'voided'`. Útil para reimprimir un comprobante anulado con auditoría visual.
- `settings.data.recibo` se lee con keys flexibles: acepta `mensajePie` (camelCase, formato que escribimos en el seed reciente como `mensaje_pie`). El servicio normaliza ambas.
- Si la impresora térmica no está conectada, el navegador mostrará el diálogo estándar y el operador puede cancelar — la venta ya está creada, no se pierde.
