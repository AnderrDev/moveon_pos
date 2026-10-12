-- RN-LF16: permitir ajustes auditados a admin y cajero de la tienda.
create or replace function public.adjust_loyalty_stamps(
  p_tienda_id uuid,
  p_cliente_id uuid,
  p_delta int,
  p_reason text,
  p_created_by uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if auth.uid() is null or auth.uid() <> p_created_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol in ('admin', 'cajero')
      and is_active = true
  ) then
    raise exception 'No autorizado para ajustar sellos en esta tienda';
  end if;

  if p_delta = 0 then
    raise exception 'El ajuste debe ser distinto de cero';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  if not exists (
    select 1 from clientes where id = p_cliente_id and tienda_id = p_tienda_id
  ) then
    raise exception 'Cliente no encontrado';
  end if;

  perform loyalty_apply_delta(
    p_tienda_id, p_cliente_id, 'adjustment', p_delta, null, btrim(p_reason), p_created_by
  );

  if p_delta > 0 then
    perform loyalty_generate_rewards(p_tienda_id, p_cliente_id, null, p_created_by);
  end if;

  select stamps_balance into v_balance
  from loyalty_accounts
  where tienda_id = p_tienda_id and cliente_id = p_cliente_id;

  insert into audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_tienda_id, p_created_by, 'loyalty.stamps_adjusted', 'loyalty_account', p_cliente_id,
    jsonb_build_object('delta', p_delta, 'reason', btrim(p_reason), 'balance_after', v_balance)
  );

  return v_balance;
end;
$$;

revoke execute on function public.adjust_loyalty_stamps(uuid, uuid, int, text, uuid) from public, anon;

grant execute on function public.adjust_loyalty_stamps(uuid, uuid, int, text, uuid) to authenticated;

