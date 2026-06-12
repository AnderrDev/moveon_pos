# Spec de Sesion - 2026-06-12 - Ticket POS 58 mm

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-12 |
| Sprint | Sprint 4+ |
| Agente | Codex |
| HUs trabajadas | TCK-01 / M7 Tickets internos |
| Estado | Implementado y listo para commit - despliegue de firma y validacion fisica pendientes |

## 1. Objetivo de la sesion

Adecuar el ticket de venta para una impresora termica Jaltech POS-58, evitar que el navegador expulse una pagina fija de 210 mm y detener el papel inmediatamente despues del contenido.

## 2. Lo que se implemento

### 2.1 Archivos creados

- `apps/pos-angular/src/app/features/pos/infrastructure/esc-pos-receipt.builder.ts` - genera el ticket ESC/POS de 32 columnas y termina con avance corto y comando de corte.
- `apps/pos-angular/src/app/features/pos/infrastructure/qz-receipt-printer.service.ts` - conecta Angular con QZ Tray, localiza `POS-58` y envia el trabajo RAW.
- `apps/pos-angular/public/assets/receipt/moveon-logo-thermal.png` - version monocromatica de 384 puntos del logo para impresion termica.
- `apps/pos-angular/src/types/qz-tray.d.ts` - tipos estrictos minimos para la API utilizada de QZ Tray.
- `tests/unit/app/features/pos/esc-pos-receipt.builder.test.ts` - valida comandos, ancho y normalizacion ASCII.
- `docs/adr/0010-impresion-escpos-qz-tray.md` - decision de arquitectura para impresion termica local.
- `docs/sessions/2026-06-12-ticket-pos-58mm.md` - registro de esta sesion.
- `apps/pos-angular/src/app/features/pos/infrastructure/qz-signing.service.ts` - configura certificado y firma remota de QZ Tray.
- `supabase/functions/qz-sign/index.ts` - Edge Function autenticada que firma hashes QZ con RSA SHA-512.
- `docs/deploy/qz-signing.md` - instalacion del certificado, secretos y despliegue.

### 2.2 Archivos modificados

- `apps/pos-angular/src/app/features/pos/receipt-print.service.ts` - reemplaza DOM y `window.print()` por el builder ESC/POS y QZ Tray.
- `apps/pos-angular/src/app/features/pos/pos.page.ts` - informa fallos de impresion sin revertir una venta ya completada.
- `apps/pos-angular/src/app/core/tienda/tienda-info.service.ts` - agrega `receipt.printerName`, con `POS-58` como valor predeterminado.
- `apps/pos-angular/src/app/core/layout/shell.component.ts` y `apps/pos-angular/src/styles.css` - eliminan el host y estilos globales de impresion del navegador.
- `package.json` y `pnpm-lock.yaml` - agregan `qz-tray@2.2.6`.
- Documentacion de alcance, roadmap, ADR y criterios de aceptacion del ticket.
- `supabase/config.toml` - declara `qz-sign` con verificacion JWT obligatoria.

### 2.3 Archivos eliminados

- `apps/pos-angular/src/app/features/pos/receipt-ticket.component.ts`.
- `apps/pos-angular/src/app/features/pos/receipt-print-host.component.ts`.

### 2.4 Entorno local

- QZ Tray 2.2.6 instalado y ejecutandose en Windows.
- Impresora detectada como `POS-58`, puerto `USB001`, procesador `winprint`, tipo de datos `RAW`.
- Servidor Angular escuchando en `http://localhost:4200`.

## 3. Decisiones tomadas

| Decision | Alternativa descartada | Razon |
|---|---|---|
| Enviar ESC/POS RAW mediante QZ Tray | Seguir ajustando CSS y `window.print()` | El navegador imprime paginas; el driver ofrece `58(48) x 210 mm` y conserva ese largo aunque el ticket sea corto. |
| Usar 32 columnas | Generar HTML o imagen rasterizada | Coincide con el ancho util habitual de una POS de 58 mm y mantiene texto nitido. |
| Terminar con `ESC d 3` y `GS V 0` | Form feed o pagina fija | Avanza solo tres lineas y solicita corte; si no hay cortador, queda listo para rasgar. |
| Configurar la impresora por nombre | Elegirla en cada venta | Evita el dialogo de impresion y mantiene el flujo rapido del POS. |
| Mantener la venta si falla la impresora | Revertir la venta | La persistencia de la venta y la impresion son operaciones separadas. |

## 4. ADRs creados o actualizados

- `docs/adr/0010-impresion-escpos-qz-tray.md` - nuevo ADR aceptado.
- `docs/adr/0004-pwa-responsive.md` - registra que `window.print()` fue reemplazado por ADR-0010.

## 5. Tests y validacion

- [x] `pnpm typecheck` - TypeScript y build Angular correctos.
- [x] `pnpm lint` - sin hallazgos.
- [x] `pnpm test` - 35 archivos y 302 tests pasaron.
- [x] `git diff --check` - sin errores de whitespace.
- [x] Aplicacion abierta en `http://localhost:4200` sin errores de consola.
- [x] Prueba fisica RAW de 112 bytes enviada a `POS-58` sin pagina fija.
- [x] Encabezado actualizado con logo y leyenda `COMPROBANTE DE VENTA`; se retiraron `POS`, `TICKET INTERNO` y `NO FISCAL` del contenido visible.
- [x] IVA discriminado por tasa en cada producto y en el resumen, con calculo de respaldo desde los items cuando `tax_total` no viene informado.
- [x] Pagina administrativa `/configuracion` para parametrizar titulo, NIT, direccion, ciudad, telefono, mensaje final, impresora y visibilidad del IVA y datos comerciales.
- [x] Preferencias persistidas por tienda en `settings.data.recibo`; la impresion las consume desde la siguiente tirilla.
- [x] Boton `Imprimir prueba` en configuracion para validar logo, contenido, IVA, avance y corte sin guardar una venta.
- [x] Espaciado y bloque de acciones de la pagina mejorados, con margen inferior para que los botones no queden pegados al borde al finalizar el scroll.
- [x] Preferencia independiente para ocultar la etiqueta `+IVA` de las cards del POS sin cambiar impuestos, totales ni la configuracion de la tirilla.
- [x] Separacion vertical corregida entre las filas de datos comerciales del formulario de configuracion.
- [x] Separacion vertical corregida entre opciones, mensaje final e impresora en el bloque de contenido y salida.
- [x] Preferencia por tienda para desactivar la impresion automatica de la tirilla al completar una venta, manteniendo disponible la impresion de prueba.
- [x] Selector por venta en el modal de cobro para decidir `Imprimir` o `No imprimir`, inicializado desde la preferencia general.
- [x] Firma remota de QZ Tray implementada con certificado publico en Angular y llave privada en Supabase Edge Functions.
- [x] `pnpm typecheck` - TypeScript y build Angular correctos despues de integrar `qz-sign`.
- [x] `pnpm test` - 35 archivos y 304 tests pasaron despues de integrar `qz-sign`.
- [x] `pnpm lint` - sin hallazgos en la revision final.
- [x] La preferencia de IVA del POS oculta tanto `+IVA` en las cards como la fila `IVA` del resumen del carrito, sin alterar calculos.
- [x] Apertura automatica de caja monedero por ESC/POS en ventas con efectivo, independiente de imprimir la tirilla, con preferencia por tienda y boton de prueba.
- [x] CORS de `qz-sign` habilitado para el sitio productivo de Netlify, ademas de localhost.
- [x] Flujo QZ optimizado: apertura de caja y ticket se envian en un solo trabajo RAW, el nombre de impresora se cachea y el logo se carga en paralelo.
- [x] UX de salida mejorada: loader bloqueante despues de guardar la venta, estado de error recuperable con reintento y feedback de reimpresion en historial.
- [x] Errores QZ clasificados para firma, conexion, permisos, impresora y logo; las operaciones concurrentes se rechazan con un mensaje controlado.
- [x] `pnpm test` - 36 archivos y 308 tests pasaron con la cobertura nueva de errores QZ.
- [x] `pnpm typecheck` - corregido `ignoreDeprecations` para TypeScript 5.9.3 y validacion completa aprobada.

## 6. Pendientes de validacion operativa

- [ ] Al imprimir desde la aplicacion por primera vez, aceptar la autorizacion de QZ Tray y marcar que recuerde la decision.
- [ ] Completar una venta real y confirmar longitud, margen y corte o punto de rasgado.
- [ ] Ejecutar `Imprimir prueba` con la configuracion deseada y confirmar fisicamente el resultado antes de correr nuevamente build y tests.
- [ ] Si el negro sale tenue, verificar el lado termico del rollo, la densidad/velocidad del driver y la limpieza del cabezal.
- [ ] Generar el certificado demo desde QZ Tray Site Manager en el computador de caja.
- [ ] Cargar `QZ_CERTIFICATE`, `QZ_PRIVATE_KEY` y `QZ_ALLOWED_ORIGINS` en secretos de Supabase.
- [ ] Desplegar `qz-sign` y confirmar que solo la primera confianza del certificado requiere autorizacion.

## 7. Notas adicionales

El comando obligatorio `bash scripts/session-start.sh` se ejecuto con Git Bash, pero fallo porque ese entorno no encontro `date`. Ya existian los specs de sesion del dia y se aplico el fallback indicado por `AGENTS.md`.

Los cambios ajenos ya presentes en el worktree se conservaron sin modificarlos ni revertirlos.
