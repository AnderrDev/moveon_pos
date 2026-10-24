# Spec de Sesión — 2026-08-14 — Auditoría de base de datos Supabase

---

## Metadatos

| Campo          | Valor                                              |
| -------------- | -------------------------------------------------- |
| Fecha          | 2026-08-14                                         |
| Sprint         | No especificado                                    |
| Agente         | Codex                                              |
| HUs trabajadas | Mejora operativa de inventario (sin HU asignada)   |
| Estado         | Completada localmente — migración remota pendiente |

---

## 1. Objetivo de la sesión

Revisar el acceso a Supabase y, a petición posterior del dueño, corregir el flujo de costos de entradas de inventario: sincronizar el costo vigente del producto, mostrar el impacto financiero y permitir correcciones auditadas sin modificar cantidades. Adicionalmente, analizar todo el histórico de ventas disponible para identificar estrategias de crecimiento basadas en demanda, mezcla, margen, clientes e inventario.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `docs/sessions/2026-08-14-auditoria-base-datos-supabase.md` — registro de esta sesión.
- `supabase/migrations/20260814000100_inventory_entry_cost_correction.sql` — RPC transaccional de entrada, RPC de corrección y hardening RLS.
- `supabase/tests/inventory-entry-cost.test.sql` — 14 casos pgTAP para entrada/corrección/permisos/auditoría.
- `apps/pos-angular/src/app/features/inventory/domain/usecases/correct-entry-cost.use-case.ts` — validación y caso de uso.
- `apps/pos-angular/src/app/features/inventory/presentation/forms/entry-cost-correction-form.*.ts` — factory y mapper Zod.
- `apps/pos-angular/src/app/features/inventory/presentation/presenters/entry-cost-correction-form.presenter.ts` — presenter Angular.
- `apps/pos-angular/src/app/features/inventory/presentation/dialogs/correct-entry-cost.dialog.ts` — corrección auditada desde Kardex.
- `tests/unit/features/inventory/entry-cost-correction-form.test.ts` y `inventory-export.test.ts` — cobertura del formulario/export.
- `scripts/reports/analyze-sales-growth.mjs` — análisis comercial reproducible, paginado y de solo lectura sobre Supabase REST.

### 2.2 Archivos modificados

- Inventario (DTO, contrato, repositorio, registro de entrada, Kardex y página) — entrada atómica, costo total visible y acceso a corrección.
- Tests unitarios de DTOs/use-cases — casos de corrección.
- `docs/modules/inventory.md` y `docs/modules/expenses.md` — reglas de costo y fondo de reinversión.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión                                                                 | Alternativa descartada                    | Razón                                                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| No aplicar la migración al remoto durante la implementación              | Desplegar directamente a producción       | El usuario autorizó agregar la funcionalidad al proyecto, no alterar producción; además las credenciales administrativas locales están desalineadas. |
| Entrada con costo actualiza `productos.costo` atómicamente               | Obligar a editar el producto por separado | Es la expectativa operativa confirmada por el dueño y evita margen futuro con costo obsoleto.                                                        |
| Corrección de entrada antigua hace opcional sincronizar el costo vigente | Actualizar siempre el producto            | Una entrada vieja no debe reemplazar el costo de una compra posterior.                                                                               |
| Corregir solo costo, nunca cantidad/ubicación                            | Editar libremente el movimiento           | Preserva el ledger de stock; diferencias físicas siguen usando `adjustment`.                                                                         |

---

## 4. ADRs creados o actualizados

- Ninguno.

---

## 5. Tests

- [ ] `pnpm typecheck` — `tsc --noEmit` pasó; el `ng build` del script aislado termina con SIGABRT del proceso sin diagnóstico. `ngc` y el build completo de `ng serve` sí pasaron.
- [x] `pnpm lint` — pasó.
- [x] `pnpm test` — 707/707 tests pasaron en 77 archivos.
- [x] `pnpm test:coverage` — 99.73% statements, 92.32% branches, 99.33% functions, 99.73% lines.
- [x] `node --check scripts/reports/analyze-sales-growth.mjs` — sintaxis válida.
- [x] Ejecución remota del análisis — 1.082 ventas leídas y 1.077 completadas analizadas al corte 2026-08-14 14:02 COT.

Detalle de fallos (si los hay):

- `pnpm exec ngc -p apps/pos-angular/tsconfig.app.json` pasó (incluye templates Angular).
- `pnpm dev --host 127.0.0.1` compiló el bundle completo y dejó el servidor listo en `http://127.0.0.1:4200`; la automatización visual del navegador no estuvo disponible por configuración del entorno.
- pgTAP escrito con 14 assertions; pendiente ejecutar contra Supabase local con Docker.

---

## 6. Bloqueos y preguntas pendientes

- [x] El esquema REST remoto es accesible; MCP no autenticado, DB password desactualizado y CLI sin privilegios administrativos.
- [ ] Ejecutar pgTAP local y aplicar la nueva migración al remoto cuando se autorice.
- [ ] Investigar el SIGABRT exclusivo del comando `ng build`; no se reproduce en `ngc` ni en la compilación de `ng serve`.

---

## 7. Próximos pasos

1. Ejecutar `supabase/tests/inventory-entry-cost.test.sql` en el stack local cuando Docker esté disponible.
2. Aplicar `20260814000100_inventory_entry_cost_correction.sql` al proyecto remoto con autorización.
3. Regenerar tipos Supabase después de aplicar la migración.
4. Verificar end-to-end: entrada actualiza costo del producto; corrección recalcula Finanzas.
5. Ejecutar durante 30 días el plan comercial derivado del análisis: recuperación de creatinas/batidos, venta cruzada, captura de clientes y liquidación controlada de inventario lento.
6. Corregir de forma auditada el costo histórico de `ARMY EAAS AMINOS&GLUTAMINE SACHET` y verificar el margen de `ISO 100 5LB`.
7. Verificar físicamente los productos sin ventas en 28 días antes de detener reposición o lanzar campañas de salida.

---

## 8. Notas adicionales

- No se realizaron cambios remotos.
- La skill `frontend-design` orientó un flujo visual contable/utilitario: comparación anterior/nuevo, total de compra destacado y advertencia contextual para entradas antiguas, respetando el design system existente.

## 9. Análisis comercial de crecimiento

### Corte y calidad de datos

- Histórico analizado: 2026-06-13 a 2026-08-14 14:02 COT.
- 1.082 ventas: 1.077 completadas, 5 anuladas (0,5%).
- Facturación completada: $29.902.705 COP; ticket promedio: $27.765 COP.
- Las líneas de venta concilian exactamente con los totales de venta.
- Dos ventas antiguas en efectivo (`V-000006` y `V-000007`) registran pagos superiores al total por $9.000 COP; parecen efectivo recibido/cambio de la etapa inicial y deben revisarse antes de usar pagos como conciliación histórica exacta.
- Se confirmó un costo histórico incorrecto en `ARMY EAAS AMINOS&GLUTAMINE SACHET`: costo capturado $49.160 por unidad frente a costo vigente $2.450 y precio $4.500. Sin corregirlo, el margen global aparece artificialmente bajo.

### Hallazgos principales

- Últimos 28 días completos vs. 28 anteriores: ventas -8,2%, facturación -7,8%, ticket +0,4%.
- Últimos 14 días completos vs. 14 anteriores: ventas -3,3%, facturación -15,6%, ticket -12,8%. La desaceleración reciente viene principalmente de menos compras de alto valor.
- En 14 días: Creatinas -50,3% (-$1.271.396), Batidos -20,1%, Pre-entrenos -26,9%; Proteínas +83,6% (+$917.364) y Termogénicos +45,7% amortiguan la caída.
- Creatinas, Proteínas y Batidos generan 69,2% de la facturación histórica. Batidos aportan margen bruto capturado cercano a 60% y son la mayor fuente de tráfico.
- 64,6% de las ventas son menores a $15.000, pero aportan solo 19% del ingreso. El 8% de ventas de al menos $100.000 aporta 50,6% del ingreso.
- Solo 26,2% de las ventas tiene más de una línea. Ticket promedio multi-línea: $46.290 frente a $21.194 en una sola línea.
- Cero ventas tienen cliente asociado. MOVE ON Club tiene una cuenta y ninguna recompensa activa/redimida: hoy no existe base para medir recurrencia o retención real.
- 40 de 111 productos activos no vendieron en los últimos 28 días. El stock positivo de esas referencias representa aproximadamente $4.920.251 COP al costo; $4.067.944 corresponden a referencias nunca vendidas en el histórico.
- Demanda pico: martes a jueves; horas 13:00–15:59 y 19:00–20:59. Domingo es el día más débil. A las 12:00 y 16:00–18:59 hay tráfico alto con ticket bajo: oportunidad de venta cruzada sin descuento general.

### Estrategia priorizada de 30 días

1. Recuperar la compra grande de Creatinas: exhibición de tres escalones de precio, disponibilidad garantizada de los ganadores y recomendación explícita junto con Proteínas. Recuperar la mitad de la caída quincenal equivale a unos $636.000 cada 14 días.
2. Subir la venta cruzada: guiones y combos sin descuento profundo para Batido + alimento proteico, Pre-entreno + bebida y Creatina + Proteína. Meta inicial: tasa multi-línea de 26,2% a 32%.
3. Capturar clientes donde más valor hay: celular obligatorio con consentimiento para MOVE ON Club en ventas >= $100.000 y oferta de inscripción en la barra de batidos. Metas: 80% de captura en tickets altos y 30% en batidos.
4. Liberar capital: congelar reposición de referencias sin venta en 28 días, validar stock físico y usar campañas dirigidas o bundles con productos tractores. No aplicar descuentos indiscriminados a todo el catálogo.
5. Proteger margen: corregir el costo del sachet, revisar `ISO 100 5LB` (margen capturado 9,1%) y usar margen por producto para decidir promociones.
6. Operar por franja: sin promociones en picos; upselling activo a las 12:00 y 16:00–18:59; prueba controlada los domingos. Evaluar cerrar/retrasar apertura a las 08:00 solo cuando se incorporen costos de personal y operación.

### KPIs semanales

- Facturación/día y ventas/día, comparadas contra los 28 días previos equivalentes.
- Ticket promedio y participación de ventas >= $100.000.
- Tasa de ventas multi-línea y unidades por venta.
- Captura de cliente total, en tickets altos y en batidos.
- Facturación y unidades de Creatinas, Batidos, Pre-entrenos y Proteínas.
- Margen bruto corregido por categoría/producto.
- Valor de inventario sin venta en 28 días.

### Detalle de días, horas y semanas

Para comparar semanas se excluyeron la primera semana parcial (el histórico comienza el sábado 13 de junio) y la semana actual incompleta.

| Posición | Semana completa | Ventas | Facturación | Ticket promedio |
| -------- | --------------- | -----: | ----------: | --------------: |
| 1        | 27 jul–2 ago    |    119 |  $4.276.700 |         $35.939 |
| 2        | 6–12 jul        |    123 |  $4.230.100 |         $34.391 |
| 3        | 29 jun–5 jul    |    151 |  $3.985.503 |         $26.394 |

- La semana completa promedio produjo $3.445.101 con 125 ventas. La semana récord estuvo 24,1% por encima del promedio gracias al ticket, no al volumen.
- La semana 29 jun–5 jul tuvo el mayor número de ventas (151), pero quedó tercera en facturación. La semana récord vendió 32 unidades transaccionales menos y facturó más.
- Después de la semana récord, la facturación cayó 32,1% en 3–9 ago ($2.904.700), aunque las transacciones subieron de 119 a 125: el ticket bajó de $35.939 a $23.238.
- Por día, martes lidera con $609.656 por día observado; le siguen miércoles ($581.511) y jueves ($537.678). Domingo es el más débil ($279.400).
- Por hora, 13:00–15:59 concentra 30,7% de la facturación y 19:00–21:59 otro 25,4%. Juntas explican aproximadamente 56,1% del ingreso.
- La franja 12:00 y 16:00–18:59 reúne 397 ventas con ticket cercano a $20.000: es la mejor ventana para venta cruzada, no para descuentos generales.
- Combinaciones recurrentes fuertes: martes 19:00 (25 ventas, ticket $45.772), miércoles 19:00–20:59 (52 ventas combinadas), jueves 19:00 (28 ventas) y sábado 13:00/15:00 (43 ventas combinadas).
- Sábado 10:00 y lunes 13:00 muestran facturación alta pero pocas ventas y tickets atípicos; no deben tratarse como picos operativos estables sin más semanas de información.

### Horario experimental corregido por apertura real de caja

El análisis inicial estaba censurado: interpretaba horas sin ventas como horas abiertas. Al cruzar `sales.cash_session_id` con `cash_sessions.opened_at/closed_at` se confirmó que esto afecta especialmente fines de semana.

- Domingo: apertura entre 08:53 y 14:58, mediana 11:24; 5 de 8 domingos abrieron después de las 10:00.
- En cuatro aperturas dominicales tardías (11:20, 11:27, 13:00 y 14:58), la primera venta llegó entre 0 y 9 minutos después, señal de posible demanda acumulada.
- La productividad ajustada por tiempo realmente abierto es $21.761 por hora a las 09:00, $44.111 a las 10:00 y supera $76.000 entre 19:00–21:59. La hora 21:00 alcanza $100.216 por hora abierta, aunque con menor exposición.

| Día          | Apertura | Cierre | Objetivo del piloto                                                                                             |
| ------------ | -------: | -----: | --------------------------------------------------------------------------------------------------------------- |
| Lunes–jueves |    10:00 |  22:00 | Reducir espera matutina y conservar las ventas nocturnas de alto valor.                                         |
| Viernes      |    10:00 |  21:00 | La apertura de las 09:00 y la hora posterior a las 21:00 muestran baja contribución observada.                  |
| Sábado       |    10:00 |  19:00 | Extender respecto al cierre mediano 17:09 para medir demanda que hoy no se puede observar.                      |
| Domingo      |    09:00 |  19:00 | Medir la demanda censurada: dos de los tres domingos abiertos antes de las 10:00 tuvieron venta casi inmediata. |

- Alternativa simple: lunes–viernes 10:00–22:00, sábado 10:00–19:00 y domingo 09:00–19:00.
- No hay evidencia suficiente para recomendar apertura a las 08:00: solo existen 2,5 horas acumuladas de exposición en esa franja, por lo que cuatro ventas no forman una muestra comparable.
- El piloto debe mantenerse 4–6 semanas sin aperturas tardías. Luego se comparan ventas, margen bruto y ventas por hora abierta de 09:00–09:59, 10:00–10:59 y 18:00–18:59 antes de reducir el horario.
- La decisión definitiva también requiere costo laboral, seguridad y servicios, que no existen en el histórico de ventas.
