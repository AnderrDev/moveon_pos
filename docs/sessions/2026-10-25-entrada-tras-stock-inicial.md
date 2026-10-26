# Spec de Sesión — 2026-10-25 — Entrada de inventario después de crear producto con stock inicial

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-25 |
| Sprint | Post-MVP (soporte) |
| Agente | Claude Code |
| HUs trabajadas | Reporte del dueño |
| Estado | Completada en local (sin publicar) |

## 1. Objetivo

El dueño reporta que, tras crear un producto con stock inicial, al darle "Entrada" le aparecen varias opciones. Reproducir, encontrar la causa y corregir.

## 2. Causa

1. Al crear un producto con stock inicial, la entrada sí se registraba (`create_product_with_initial_stock`), pero Productos no volvía a leer el stock: la fila quedaba en "0 · Agotado" hasta recargar.
2. El stock inicial y la entrada venían por defecto en **Bodega**, mientras que el POS vende y mide "Agotado" en **punto de venta**. El producto aparecía agotado aunque tuviera unidades guardadas, e invitaba a darle otra entrada (y a elegir entre varias opciones de ubicación). En producción el 97% de los stocks iniciales y el 88% de las entradas se registran en punto de venta (se cambiaba a mano cada vez).

## 3. Lo que se implementó

- `productos.page.ts`: al guardar un producto se relee el stock; un producto con 0 en punto de venta pero stock en bodega muestra "En bodega" (no "Agotado") con el botón "Pasar al punto de venta" (abre el traslado).
- Formulario de producto y entrada de inventario: ubicación por defecto **Punto de venta** (Bodega sigue disponible).
- Tests actualizados (defaults).

## 4. Verificación (local)

- 912 pruebas y lint OK.
- Navegador: producto con stock inicial 8 aparece con 8 en punto de venta al instante; el de 10 en bodega muestra "En bodega" + "Pasar al punto de venta"; la entrada abre con "Punto de venta".
- Quedan en la base local dos productos de prueba ("QA Prueba stock inicial", "QA Prueba stock PV").
