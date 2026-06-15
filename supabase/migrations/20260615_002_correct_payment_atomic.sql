-- =====================================================
-- RPC correct_payment_atomic
-- Corrige el método de pago de un registro en `payments`.
-- Solo admin puede ejecutar. Solo mientras la sesión de caja esté abierta.
-- El monto (amount) nunca se modifica.
-- Segunda llamada con mismo paymentId y mismo newMetodo es idempotente.
-- =====================================================

create or replace function public.correct_payment_atomic(
  p_payment_id   uuid,
  p_tienda_id    uuid,
  p_new_metodo   public.payment_method,
  p_corrected_by uuid,
  p_reason       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_metodo  public.payment_method;
  v_sale_id     uuid;
  v_sale_number text;
  v_session_id  uuid;
begin
  if auth.uid() is null or auth.uid() <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede corregir métodos de pago';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  select
    pay.metodo,
    s.id,
    s.sale_number,
    s.cash_session_id
  into
    v_old_metodo,
    v_sale_id,
    v_sale_number,
    v_session_id
  from public.payments pay
  join public.sales s on s.id = pay.sale_id
  where pay.id = p_payment_id
    and s.tienda_id = p_tienda_id
    and s.status = 'completed';

  if v_sale_id is null then
    raise exception 'Pago no encontrado o la venta ya fue anulada';
  end if;

  if not exists (
    select 1
    from public.cash_sessions
    where id = v_session_id
      and status = 'open'
  ) then
    raise exception 'Solo se puede corregir el pago mientras la sesión de caja esté abierta';
  end if;

  update public.payments
  set metodo = p_new_metodo
  where id = p_payment_id;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id,
    p_corrected_by,
    'sale.payment_corrected',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'old_metodo',   v_old_metodo,
      'new_metodo',   p_new_metodo,
      'reason',       btrim(p_reason),
      'sale_id',      v_sale_id,
      'sale_number',  v_sale_number
    )
  );
end;
$$;

revoke execute on function public.correct_payment_atomic(uuid, uuid, public.payment_method, uuid, text)
  from public, anon;

grant execute on function public.correct_payment_atomic(uuid, uuid, public.payment_method, uuid, text)
  to authenticated;

comment on function public.correct_payment_atomic(uuid, uuid, public.payment_method, uuid, text) is
  'Corrige el método de pago de un registro en payments. Solo admin activo en tienda, solo con sesión de caja abierta. Registra en audit_logs. El amount nunca se modifica.';
