# Spec de Sesion - 2026-06-12 - Limpieza de base de datos

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-12 |
| Sprint | Preparacion operativa |
| Agente | Codex |
| HUs trabajadas | Operacion de datos |
| Estado | Completada |

---

## 1. Objetivo de la sesion

Limpiar el Supabase remoto y dejar una tienda con exactamente dos usuarios activos: un administrador y un empleado con rol tecnico `cajero`.

---

## 2. Lo que se implemento

### 2.1 Base de datos remota

- Se eliminaron todos los registros de ventas, items, pagos, documentos y eventos de facturacion.
- Se eliminaron sesiones y movimientos de caja, movimientos de inventario y contadores de venta.
- Se eliminaron productos, categorias, clientes y registros de auditoria.
- Se conservaron la tienda `MOVEONAPP POS` y su registro de configuracion.
- Se conservaron `admin@moveonpos.co` con rol `admin` y `cajero@moveonpos.co` con rol `cajero`, ambos activos y confirmados.

### 2.2 Archivos creados

- `docs/sessions/2026-06-12-limpieza-base-datos.md` - registro de la operacion.

---

## 3. Decisiones tomadas

| Decision | Alternativa descartada | Razon |
|---|---|---|
| Conservar tienda, configuracion y membresias de usuario | Reiniciar todo el esquema | La solicitud fue limpiar los datos y mantener dos accesos funcionales. |
| Usar el rol existente `cajero` para el empleado | Introducir un rol nuevo `empleado` | El dominio y las politicas RLS solo admiten `admin` y `cajero`. |
| Ejecutar la limpieza en una transaccion | Borrados manuales independientes | Evita dejar la base parcialmente limpia si ocurre un error. |

---

## 4. ADRs creados o actualizados

- Ninguno. No hubo cambios arquitectonicos ni de esquema.

---

## 5. Verificacion

- [x] Tablas operativas y de catalogo verificadas con `0` registros.
- [x] Una tienda conservada.
- [x] Un registro de configuracion conservado.
- [x] Dos membresias activas verificadas: `admin` y `cajero`.
- [x] Exactamente dos usuarios presentes en Supabase Auth.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` no aplican: no se modifico codigo ejecutable.

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Proximos pasos

1. Cargar el catalogo e inventario inicial reales cuando esten disponibles.
2. Cambiar las contrasenas temporales antes de operar en produccion, si aun siguen vigentes.

---

## 8. Notas adicionales

La configuracion del comprobante se preservo deliberadamente. El contador de ventas quedo vacio, por lo que la siguiente venta iniciara nuevamente el correlativo segun la logica vigente.
