# Diseño — Resumen de turno y retiro opcional al cerrar caja

**Fecha:** 2026-09-13  
**Estado:** Aprobado funcionalmente; pendiente de plan de implementación  
**Módulo:** `cash-register`

## 1. Contexto

MOVEONAPP ya registra una sesión de caja compartida por tienda, ventas por método de pago,
movimientos manuales, efectivo esperado, efectivo contado y diferencias de cierre. Sin embargo, el
flujo no representa de forma explícita una práctica operativa que hoy se lleva manualmente en una
hoja de cálculo: retirar parte del efectivo al finalizar un turno y dejar una base para el turno
siguiente.

La hoja actual registra por turno fecha, responsable, base inicial, ventas en efectivo,
ventas por transferencia, ingresos adicionales, gastos y efectivo final. El análisis muestra que,
en algunos cierres, el efectivo final es menor que el valor disponible calculado; esa diferencia
corresponde a un retiro implícito que no tiene campo ni trazabilidad propios.

## 2. Objetivo

Hacer visible y auditable el cuadre completo de cada turno:

- ventas en efectivo y transferencia, con monto y número de pagos;
- base inicial, ingresos, gastos y retiros realizados durante el turno;
- efectivo esperado antes del cierre;
- efectivo físico contado, sobrante o faltante;
- retiro opcional realizado al cerrar;
- efectivo que queda en el cajón para el siguiente turno.

## 3. Alcance

### Incluido

- Un resumen contable claro en la sesión activa.
- Acceso directo para registrar un retiro durante el turno usando el movimiento existente
  `cash_out`.
- Un retiro opcional dentro del cierre de caja.
- Persistencia atómica del conteo, el retiro de cierre y el efectivo dejado.
- Sugerencia del efectivo dejado en el último cierre como base de la próxima apertura.
- Presentación de estos valores en el historial de turnos cerrados y en la exportación del turno.
- Pruebas de dominio, DTO, casos de uso, repositorio/RPC y formularios.

### Fuera de alcance

- Múltiples cajones simultáneos por tienda.
- Conciliación bancaria automática de transferencias.
- Denominaciones de billetes y monedas.
- Aprobaciones de retiros por un segundo usuario.
- Conversión de retiros en gastos contables.

## 4. Alternativas consideradas

### A. Cierre atómico con retiro propio — elegida

El usuario cuenta el efectivo, decide opcionalmente cuánto dejar y el sistema calcula el retiro.
El RPC de cierre guarda los tres conceptos dentro de la misma transacción.

Ventajas: conserva la semántica contable, evita cierres parciales, permite auditoría explícita y
facilita sugerir la próxima base. Requiere una migración y ampliar los contratos actuales.

### B. Registrar manualmente un `cash_out` antes de cerrar

Reutiliza el modelo actual sin columnas nuevas. Es más corto, pero el operador puede olvidar el
movimiento, el retiro queda mezclado con otros retiros y el cálculo del faltante puede resultar
confuso según el orden de las acciones.

### C. Crear un subsistema independiente de remesas

Permitiría bolsas, destinos, comprobantes y aprobaciones. Es excesivo para una operación con una
tienda y un cajón, y queda fuera del MVP.

## 5. Modelo contable

Todos los valores se manejan en centavos enteros.

```text
efectivo esperado antes del cierre
  = base inicial
  + ventas completadas en efectivo
  + ingresos de caja activos
  - gastos activos
  - retiros de caja activos durante el turno

diferencia de efectivo
  = efectivo esperado antes del cierre - efectivo contado

retiro del cierre
  = efectivo contado - efectivo dejado
```

La convención existente de `difference` se conserva: un valor positivo representa faltante y uno
negativo representa sobrante.

El efectivo contado siempre describe el dinero físico presente **antes** de efectuar el retiro del
cierre. El retiro no altera retroactivamente el efectivo esperado ni la diferencia del turno. El
efectivo dejado debe cumplir `0 <= efectivo dejado <= efectivo contado`.

Si el usuario no activa el retiro opcional:

- `closing_withdrawal_amount = 0`;
- `cash_left_amount = actual_cash_amount`.

## 6. Persistencia y transacción

Se amplía `cash_sessions` con dos valores no negativos:

- `closing_withdrawal_amount`: efectivo retirado como parte del cierre;
- `cash_left_amount`: efectivo que permanece en el cajón después del cierre.

Para sesiones históricas se migran valores compatibles: retiro `0` y efectivo dejado igual al
efectivo contado cuando este exista. No se intentará inferir retiros históricos.

`close_cash_session_atomic` recibirá el efectivo contado y el efectivo que se desea dejar. Dentro
de una sola transacción deberá:

1. validar autenticación, pertenencia activa a la tienda y sesión abierta;
2. recalcular ventas, pagos y movimientos activos desde la base de datos;
3. validar montos y calcular retiro, diferencias y desglose del cierre;
4. cerrar la sesión y guardar conteo, retiro y efectivo dejado;
5. registrar los valores nuevos en el evento de auditoría del cierre.

El retiro del cierre no se insertará también como `cash_movement`, porque duplicaría su impacto en
el cuadre. Los retiros que ocurran antes del cierre continuarán como movimientos `cash_out`.

La apertura consultará la última sesión cerrada de la tienda y usará `cash_left_amount` únicamente
como valor sugerido. El usuario puede confirmarlo o modificarlo; no se fuerza una apertura
automática.

## 7. Dominio y contratos

La entidad de sesión y los DTO de cierre incorporarán los dos valores nuevos. El caso de uso de
cierre recibirá:

- efectivo contado;
- confirmación de transferencias según el flujo actual;
- efectivo que queda, derivado por el formulario cuando el retiro está desactivado;
- nota de cierre cuando las diferencias excedan el umbral existente.

El repositorio expondrá una lectura para obtener la base sugerida desde el último cierre. La capa
de presentación seguirá dependiendo solo del contrato de dominio; Supabase permanecerá confinado
a `data/`.

## 8. Experiencia de usuario

### Sesión activa

La pantalla de Caja mostrará un bloque **Cuadre del turno** con:

- tarjeta de efectivo: cantidad de pagos y total vendido;
- tarjeta de transferencias: cantidad de pagos y total vendido;
- fórmula del efectivo esperado: base, efectivo vendido, ingresos, gastos y retiros;
- total esperado en el cajón en tamaño destacado.

Se mantendrán las listas detalladas de ventas y movimientos. Junto a la acción general de
movimientos habrá un acceso **Retirar efectivo**, que abre el diálogo existente con `cash_out`
preseleccionado. Esto no cambia permisos ni reglas de anulación/corrección.

### Cierre

El diálogo se organiza en este orden:

1. resumen de ventas por efectivo y transferencia;
2. efectivo esperado;
3. campo de efectivo contado y diferencia en vivo;
4. control opcional **Retirar efectivo al cerrar**;
5. al activarlo, campo **Efectivo que dejarás en caja** y retiro calculado en vivo;
6. confirmación final con esperado, contado, diferencia, retiro y efectivo restante.

El valor sugerido para dejar será la base inicial del turno actual, limitado al efectivo contado.
Esto favorece una base estable sin imponerla. Si el usuario no activa el control, se deja todo el
efectivo contado.

### Apertura siguiente

El formulario precarga el efectivo dejado por la última sesión cerrada y explica su origen. Sigue
siendo editable para cubrir conteos reales o correcciones operativas.

### Historial y exportación

Cada turno cerrado mostrará, además de los valores actuales:

- ventas en efectivo;
- ventas por transferencia;
- efectivo contado antes del retiro;
- retiro del cierre;
- efectivo dejado;
- diferencia.

La exportación usará los mismos conceptos y nombres para que sustituya el seguimiento manual sin
perder información.

## 9. Validaciones y errores

- No se aceptan montos negativos.
- El efectivo dejado no puede superar el efectivo contado.
- Un cierre repetido o sobre una sesión cerrada se rechaza sin registrar retiro parcial.
- Los datos mostrados en pantalla son informativos; el RPC vuelve a calcular todos los esperados
  para evitar cierres con información obsoleta o manipulada.
- Se conserva la nota obligatoria para diferencias superiores a $5.000 COP.
- Los errores de dominio se presentan en español y el diálogo conserva los datos digitados para
  que el usuario pueda corregirlos.

## 10. Permisos y auditoría

Se conserva la caja compartida por tienda definida en ADR 0007. Cualquier usuario activo de la
tienda que puede cerrar la caja puede registrar el retiro opcional del cierre. La auditoría guarda
quién cerró, efectivo esperado, contado, diferencia, retiro y efectivo dejado.

Los turnos anteriores continúan visibles solo para administradores. Los retiros manuales durante
el turno mantienen las reglas existentes de corrección y anulación.

## 11. Estrategia de pruebas

- Dominio/DTO: límites, montos negativos, efectivo dejado mayor al contado y retiro derivado.
- Caso de uso: retiro desactivado, retiro parcial, retiro total y propagación de errores.
- SQL/RPC: cálculo atómico, movimientos anulados excluidos, sesión ya cerrada, permisos,
  idempotencia operativa y auditoría.
- Formularios/presenter: cálculo reactivo, sugerencia limitada, nota obligatoria y preservación de
  datos después de un error.
- Repositorio: mapeo de nuevas columnas y recuperación de la última base sugerida.
- Regresión: cierre sin retiro conserva el comportamiento actual; ventas y retiros previos siguen
  afectando el efectivo esperado una sola vez.

## 12. Criterios de aceptación

1. Antes de cerrar, el usuario ve monto y cantidad de ventas en efectivo y transferencia.
2. El sistema explica cuánto efectivo debería existir y cómo se compone.
3. El usuario registra el efectivo contado y ve el faltante o sobrante antes de confirmar.
4. El retiro de cierre es opcional y se calcula a partir del efectivo que el usuario decide dejar.
5. Conteo, retiro, efectivo dejado y cierre se guardan juntos o no se guarda ninguno.
6. El historial identifica claramente retiros durante el turno y retiro realizado al cierre.
7. La próxima apertura sugiere el efectivo dejado, pero permite editarlo.
8. Un cierre sin retiro funciona como hoy y deja todo el efectivo contado en caja.
9. La exportación del turno incluye los nuevos datos y permite reemplazar el registro manual.

