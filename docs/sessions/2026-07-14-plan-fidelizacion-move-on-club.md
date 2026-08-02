# Spec de Sesión — 2026-07-14 — Planeación programa de fidelización MOVE ON Club

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-07-14 |
| Sprint | Ninguno activo — planeación adelantada para v1.3 / Sprint 8 |
| Agente | Claude Code |
| HUs trabajadas | Ninguna (sesión de planeación, sin implementación) |
| Estado | Completada (planeación) |

---

## 1. Objetivo de la sesión

El dueño del negocio pidió planear un programa de fidelización llamado **MOVE ON Club**: por
cada 8 batidos pagados que cumplan las condiciones, el cliente recibe 1 batido base gratis
(hasta $11.000 COP). Especificó mecánica de acumulación, recompensa, registro de clientes por
celular y control de fraude/duplicados. El objetivo de la sesión fue producir un diseño completo
y accionable, sin implementar código todavía.

---

## 2. Lo que se implementó

Ningún código. Solo documentación de planeación:

### 2.1 Archivos creados
- `docs/adr/0013-programa-fidelizacion-move-on-club.md` — decisión arquitectónica: ledger
  auditable + mutación solo vía RPC `SECURITY DEFINER`, celular como identidad principal,
  elegibilidad de producto explícita, redención como descuento dirigido fuera del tope RN-S09,
  configuración en `settings.data.fidelizacion`.
- `docs/modules/loyalty.md` — especificación funcional completa del módulo `loyalty`: entidades,
  reglas RN-LF01–RN-LF16, esquema de datos borrador, RPC, RLS, UI y plan de testing.

### 2.2 Archivos modificados
- `docs/modules/customers.md` — se reemplazó el placeholder "Documentar cuando llegue ese
  sprint" por reglas RN-CL04–RN-CL07 (celular como identificador, normalización, autorizaciones
  independientes, registro rápido) y referencia cruzada a `loyalty.md`.
- `docs/plan-de-trabajo.md` — se agregó el bloque "Programa de fidelización MOVE ON Club (v1.3)"
  con PLAN-50 a PLAN-60, siguiendo el mismo formato de prioridad P0–P2 y criterio de cierre usado
  en el resto del plan.

### 2.3 Archivos eliminados
- Ninguno.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Ledger append-only (`loyalty_transactions`) + proyección cacheada (`loyalty_accounts`) | Contador simple `clientes.sellos_actuales` mutable | El negocio pidió explícitamente evitar modificaciones directas de saldo y mantener historial completo |
| Mutación de saldo solo vía RPC `SECURITY DEFINER`, RLS solo-lectura para todos los roles | Permitir `UPDATE` a `admin` para ajustes | Ajustes manuales también deben quedar auditados en el ledger, sin excepción de "admin puede editar directo" |
| Redención como descuento dirigido excluido del tope RN-S09 | Reutilizar el mecanismo de descuento manual existente | Un descuento de $11.000 en un ítem de $11-13k excedería o rozaría el tope de 50% pensado para descuentos discrecionales, bloqueando el canje para el cajero |
| Elegibilidad de producto explícita (`productos.participa_fidelizacion`) | Inferir de `tipo = 'prepared'` | El admin debe poder decidir qué batidos participan; no todo `prepared` necesariamente cuenta, y podría incluirse algo `simple` a futuro |
| Recompensa como tope de valor ($11.000), no atada a un producto específico | Lista fija de "producto canjeable" | La regla de negocio permite cualquier batido con cobro de diferencia si excede el tope — más flexible y fiel al requisito |
| Vigencia de recompensa evaluada de forma perezosa (sin cron obligatorio) | Edge Function con `pg_cron` desde el día 1 | Reduce superficie de implementación inicial; el barrido explícito queda como mejora P2 (PLAN-60) |
| No iniciar implementación en esta sesión | Empezar por PLAN-50 de inmediato | El roadmap ubica fidelización en v1.3, después de v1.1/v1.2; se dejó el bloque listo pero marcado "no iniciar antes de confirmar prioridad" |

---

## 4. ADRs creados o actualizados

- `docs/adr/0013-programa-fidelizacion-move-on-club.md` — ledger auditable + RPC-only para
  MOVE ON Club (estado: Propuesto, no implementado).

---

## 5. Tests

No aplica — sesión de planeación sin código.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Pregunta para el dueño del negocio: ¿se adelanta MOVE ON Club antes de v1.1 (facturación)
  y v1.2 (recetas), o se respeta el orden del roadmap? El bloque PLAN-50..60 queda documentado
  pero **no se debe iniciar sin esta confirmación**.
- [ ] Confirmar con el negocio si el "batido base" tiene un precio de referencia fijo distinto
  del precio de lista más bajo entre los batidos elegibles, o si $11.000 siempre es el tope
  aplicado sin importar cuál sea el batido más barato del catálogo.
- [ ] Confirmar si se requiere notificación al cliente (SMS/WhatsApp) cuando desbloquea una
  recompensa — no estaba en el pedido original y no se incluyó en el diseño; si se quiere, es un
  módulo adapter nuevo (patrón similar a `BillingProvider`).

---

## 7. Próximos pasos

1. Obtener confirmación de prioridad/timing del dueño del negocio (ver bloqueo §6).
2. Si se confirma inicio: el agente `architect` debe revisar la firma actual de
   `create_sale_atomic` (`supabase/migrations/20260615_001_discount_traceability.sql`) y el flujo
   de anulación de venta antes de tocarlos, y confirmar el orden de inserts para resolver la
   referencia circular `sale_items.loyalty_reward_id` ↔ `loyalty_rewards.redeemed_sale_id`
   (nota en `docs/modules/loyalty.md`).
3. Ejecutar PLAN-50 → PLAN-60 en orden vía el pipeline architect → developer → auditor ya usado
   en el resto del proyecto.

---

## 8. Notas adicionales

El pedido original del negocio no mencionó notificaciones, límites de recompensas simultáneas
por cliente, ni vencimiento de sellos individuales (solo de recompensas ya generadas) — el
diseño asume que los sellos en sí no vencen, solo las recompensas de 30 días. Si el negocio
quisiera que los sellos también caduquen, es un cambio de regla a discutir antes de PLAN-50.
