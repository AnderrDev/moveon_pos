# ADR 0010 - Impresion termica RAW con ESC/POS y QZ Tray

**Fecha:** 2026-06-12
**Estado:** Aceptado
**Decisores:** Dueno del negocio + equipo MOVEONAPP

## Contexto

La impresion de tickets se implemento inicialmente con `window.print()` y CSS de 58 mm. En la prueba fisica, Chrome y el driver `POS-58` trataron el recibo como una hoja fija de `58 x 210 mm`. Aunque el contenido ocupaba pocos centimetros, el driver avanzaba toda la longitud de la hoja y desperdiciaba papel.

Windows reporta la impresora instalada con estas caracteristicas:

- Nombre: `POS-58`.
- Puerto: `USB001`.
- Procesador: `winprint`.
- Tipo de datos: `RAW`.

CSS Paged Media controla la presentacion de paginas, pero no ofrece una forma fiable de finalizar un trabajo de rollo exactamente despues de la ultima linea cuando el driver expone un formulario fijo. Las impresoras POS resuelven este flujo mediante comandos ESC/POS enviados en modo RAW.

## Decision

Usar **QZ Tray 2.2** como puente local entre la PWA Angular y la cola de impresion de Windows, y enviar el ticket como comandos **ESC/POS RAW**.

- Dependencia web: paquete `qz-tray`.
- Agente local: QZ Tray instalado y abierto en el computador de caja.
- Impresora por defecto del adaptador: `POS-58`, configurable en `settings.data.recibo.printerName`.
- Ancho logico: 32 caracteres por linea para papel de 58 mm.
- Encabezado grafico: logo monocromatico de 384 puntos y leyenda neutral `COMPROBANTE DE VENTA`.
- El comprobante no se identifica como factura electronica salvo que exista un documento de facturacion emitido e integrado al flujo.
- Fin de trabajo: tres lineas de avance (`ESC d 3`) y corte completo (`GS V 0`). Si la impresora no incorpora cortador, el comando se ignora y el papel queda listo para rasgar.
- `window.print()` deja de utilizarse para tickets de venta.
- La venta nunca se revierte si falla la impresion; el operador recibe un error y puede reimprimir desde el historial.

El generador ESC/POS es TypeScript puro y el acceso a QZ Tray vive en un servicio de infraestructura Angular.

## Seguridad y despliegue

QZ Tray solicita autorizacion al conectar un sitio no firmado. Para evitar el aviso repetitivo, Angular obtiene el certificado publico y solicita la firma de cada mensaje a la Edge Function autenticada `qz-sign`.

- Algoritmo: RSA SHA-512.
- Certificado y llave privada: secretos `QZ_CERTIFICATE` y `QZ_PRIVATE_KEY` de Supabase.
- La llave privada no se incluye en Angular ni se guarda en el repositorio.
- La funcion exige JWT valido y una relacion activa en `user_tiendas`.
- Los origenes web permitidos se restringen con `QZ_ALLOWED_ORIGINS`.
- Si la funcion todavia no esta desplegada, la aplicacion mantiene el flujo sin firma para no bloquear la impresion durante la instalacion.

La configuracion operativa se documenta en `docs/deploy/qz-signing.md`.

## Consecuencias

### Positivas

- El papel avanza solo el contenido del ticket y el pequeno margen final.
- No depende de una longitud fija como 210 mm.
- Permite negrita, alineacion, avance y corte nativos de la impresora.
- La reimpresion usa exactamente el mismo formato.

### Negativas

- QZ Tray debe estar instalado y ejecutandose en cada computador de caja.
- La primera conexion puede mostrar una solicitud de autorizacion.
- La compatibilidad final del comando de corte depende de que el modelo tenga cortador fisico.

## Alternativas consideradas

| Alternativa | Razon para descartarla |
|---|---|
| `window.print()` + CSS dinamico | El driver mantiene el formulario de 58 x 210 mm y avanza papel en blanco. |
| WebUSB directo | Requiere HTTPS, permiso de usuario y normalmente reemplazar o liberar el driver USB que Windows ya usa para imprimir. |
| Servicio local propio | Aumenta superficie de seguridad, instalacion y mantenimiento frente a un puente especializado y probado. |
| PDF/imagen | Sigue siendo impresion por paginas y no controla de forma nativa el fin del rollo. |

## Referencias

- QZ Tray, impresion RAW y ejemplo ESC/POS: https://qz.io/docs/raw
- QZ Tray, conexion desde aplicaciones web: https://qz.io/docs/getting-started
- QZ Tray, firma para impresion silenciosa: https://qz.io/docs/signing
- CSS Paged Media `size`: https://www.w3.org/TR/css-page-3/#page-size-prop
- WebUSB API: https://wicg.github.io/webusb/
