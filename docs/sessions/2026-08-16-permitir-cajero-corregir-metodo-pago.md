# Spec de Sesión — 2026-08-16 — Permitir a cajero corregir método de pago

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-08-16 |
| Sprint | Sprint 4 |
| Agente | Claude Code |
| HUs trabajadas | (ajuste de permisos, sin HU formal) |
| Estado | Completada |

---

## 1. Objetivo de la sesión

Actualmente solo `admin` puede corregir el método de pago de una venta (`correct_payment_atomic`, `canCorrectPayment`). El dueño pidió que **todos los usuarios** (admin y cajero) puedan hacerlo.

---

## 2. Lo que se implementó

### 2.2 Archivos modificados
- `apps/pos-angular/src/app/core/auth/role-policy.ts` — `canCorrectPayment` ahora permite cualquier rol autenticado (admin y cajero), no solo admin.
- `supabase/migrations/<timestamp>_allow_cajero_correct_payment.sql` — nueva migración que reemplaza `correct_payment_atomic` para exigir solo un usuario activo en la tienda (cualquier rol), no `rol = 'admin'`.
- `apps/pos-angular/src/app/features/pos/presentation/dialogs/sales-history.dialog.ts` — comentario actualizado (ya no dice "solo admin").
- `tests/unit/app/core/auth/role-guard.test.ts`, `tests/unit/app/features/pos/correct-payment-policy.test.ts` — actualizados para reflejar que cajero también puede corregir el pago.
- `docs/modules/sales.md` — RN-S08 actualizado.

---

## 3. Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Cambiar solo `correct_payment_atomic`, no `correct_sale_customer_atomic` | Cambiar ambos | El dueño pidió explícitamente "corregir el método de pago", no la asociación retroactiva de cliente. Esa sigue siendo admin-only (RN-S13, otorga sellos de fidelización). |

---

## 5. Tests

- [x] `pnpm typecheck` — pasó
- [x] `pnpm lint` — pasó
- [x] `pnpm test` — 707 tests pasaron, 0 fallaron

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Próximos pasos

1. Ninguno pendiente para este cambio puntual.

---

## 8. Notas adicionales

`canVoidSale` y `canViewClosedSessions` siguen siendo admin-only; no se tocaron.

Migración `20260816000100_allow_any_role_correct_payment.sql` aplicada:
- **Local**: `supabase migration up --local` (de paso también aplicó `20260814000100`, que estaba pendiente localmente).
- **Remoto** (`rmaieqyscchtxxkgxgik`): aplicada vía `SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token.pos) supabase db query --linked -f ...` (no se usó `db push`, por el drift de historial ya documentado en [[project-supabase-remote-access]]). Se registró manualmente en `supabase_migrations.schema_migrations`. Verificado con `pg_proc.prosrc`: ya no contiene el chequeo `rol = 'admin'`.

**Drift preexistente detectado (no corregido en esta sesión, fuera de alcance):** `supabase migration list --linked` muestra varias migraciones locales sin contraparte en remoto: `20260624000100/200`, `20260710000100/200`, `20260723010000/020000` (asociación retroactiva de cliente), `20260814000100`. Si se toca ese código (`correct_sale_customer_atomic`, etc.), verificar primero si ya está en remoto antes de asumir que sí.
