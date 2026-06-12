# Modulo: settings (Configuracion)

## Responsabilidad

Administrar parametros operativos por tienda. La primera seccion implementada configura el comprobante termico sin cambiar codigo ni sobrescribir otros bloques del JSON `settings.data`.

## Configuracion del comprobante

Los valores viven en `settings.data.recibo`:

- `titulo`, `nit`, `direccion`, `ciudad`, `telefono` y `mensajePie`.
- `mostrarNit`, `mostrarDireccion`, `mostrarTelefono` y `mostrarIva`.
- `mostrarIvaEnPos`, para controlar las etiquetas de IVA en las cards del catalogo y en el resumen del carrito sin alterar los calculos.
- `imprimirAlFinalizarVenta`, para activar o desactivar el envio automatico de la tirilla despues de guardar una venta.
- `abrirCajonEnEfectivo`, para enviar el pulso ESC/POS de apertura cuando una venta incluya un pago en efectivo.
- `printerName`, nombre exacto de la cola instalada en Windows.

La pantalla `/configuracion` esta restringida al rol `admin`. El servicio valida nuevamente el rol antes de leer o escribir. Al guardar invalida `TiendaInfoService` para que la siguiente impresion use los cambios.

La accion `Imprimir prueba` genera una tirilla de muestra con los valores que estan actualmente en el formulario, incluso si todavia no se han guardado. No crea ventas ni movimientos; solo envia un trabajo ESC/POS RAW a la impresora configurada.

Desactivar la impresion al finalizar una venta no deshabilita `Imprimir prueba` ni modifica el registro de la venta. Solo omite el envio automatico a QZ Tray.

En el modal de cobro, el cajero puede cambiar entre `Imprimir` y `No imprimir` para la venta actual. La seleccion comienza con el valor de `imprimirAlFinalizarVenta` cada vez que se abre el cobro y no modifica la configuracion guardada.

La caja monedero se controla a traves del puerto de la impresora. Al habilitar `abrirCajonEnEfectivo`, la aplicacion envia `ESC p` al pin 2 despues de guardar una venta con efectivo; tambien funciona en pagos mixtos y es independiente de la impresion de la tirilla. `Probar caja` permite validar la conexion sin registrar una venta.

La escritura mezcla el bloque `recibo` con el JSON actual; no elimina configuraciones ajenas guardadas en `settings.data`.
