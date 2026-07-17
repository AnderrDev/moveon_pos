-- ============================================================
-- MIGRACIÓN — Vencimiento explícito de recompensas MOVE ON Club (PLAN-60)
-- Ver docs/adr/0013-programa-fidelizacion-move-on-club.md §7 y
-- docs/modules/loyalty.md (RN-LF09).
--
-- La vigencia ya se evalúa perezosamente en consulta y canje; este barrido
-- marca `expired` explícitamente para que el historial y los reportes no
-- muestren recompensas `available` ya vencidas. Sin pg_cron: la UI lo invoca
-- oportunistamente (reporte de fidelización y ficha de cliente) y es
-- idempotente — correrlo dos veces no duplica nada.
-- ============================================================

create or replace function public.expire_loyalty_rewards(p_tienda_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_balance int;
  v_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Cualquier usuario activo de la tienda puede ejecutar el barrido: no muta
  -- saldos (delta 0), solo materializa un estado que ya es cierto por fecha.
  if not exists (
    select 1 from user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and is_active = true
  ) then
    raise exception 'Sin acceso a la tienda';
  end if;

  for v_reward in
    select id, cliente_id
    from loyalty_rewards
    where tienda_id = p_tienda_id
      and status = 'available'
      and expires_at <= now()
    order by expires_at
    for update skip locked
  loop
    update loyalty_rewards
    set status = 'expired'
    where id = v_reward.id;

    -- Rastro en el ledger (type 'expire', delta 0): los sellos ya se
    -- consumieron al generar la recompensa (loyalty_generate_rewards),
    -- así que vencer no cambia el saldo — solo deja la pérdida visible
    -- en el historial del cliente.
    select stamps_balance into v_balance
    from loyalty_accounts
    where tienda_id = p_tienda_id and cliente_id = v_reward.cliente_id
    for update;

    insert into loyalty_transactions (
      tienda_id, cliente_id, sale_id, type, stamps_delta, balance_after,
      reason, created_by
    ) values (
      p_tienda_id, v_reward.cliente_id, null, 'expire', 0, coalesce(v_balance, 0),
      'Recompensa vencida sin canjear', auth.uid()
    );

    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    insert into audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
    values (
      p_tienda_id, auth.uid(), 'loyalty.rewards_expired', 'loyalty_reward', p_tienda_id,
      jsonb_build_object('count', v_count)
    );
  end if;

  return v_count;
end;
$$;

revoke execute on function public.expire_loyalty_rewards(uuid) from public, anon;
grant execute on function public.expire_loyalty_rewards(uuid) to authenticated;
