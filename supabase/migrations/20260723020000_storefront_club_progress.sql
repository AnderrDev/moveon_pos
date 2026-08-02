-- 20260723020000: RPC storefront_club_progress (ADR 0016, PLAN-70)
-- Consulta pública (anon) del progreso MOVE ON Club por celular, desde el
-- catálogo. Decisión del dueño: abierta a cualquiera, sin cuentas.
-- Salvaguardas del ADR: proyección mínima cerrada, solo clientes activos
-- con autoriza_fidelizacion, y sin oráculo de existencia (0 filas para
-- cualquier caso fallido: no existe, inactivo, sin autorización o programa
-- del club apagado — la UI muestra un único mensaje genérico).

create or replace function public.storefront_club_progress(p_celular text)
returns table (
  primer_nombre text,
  stamps_balance int,
  sellos_para_recompensa int,
  recompensas_disponibles int,
  recompensa_valor_cop numeric,
  proxima_expiracion timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_digits text;
  v_normalizado text;
  v_cliente record;
  v_cfg record;
begin
  -- Normalización idéntica a phone-co.ts (RN-CL05): 10 dígitos empezando
  -- por 3; acepta prefijo 57 (12 dígitos) y cualquier separador.
  v_digits := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
  if v_digits ~ '^3\d{9}$' then
    v_normalizado := v_digits;
  elsif length(v_digits) = 12 and left(v_digits, 2) = '57' and substr(v_digits, 3) ~ '^3\d{9}$' then
    v_normalizado := substr(v_digits, 3);
  else
    return; -- entrada no normalizable: misma respuesta vacía que "no existe"
  end if;

  select c.id, c.tienda_id, c.nombre
  into v_cliente
  from clientes c
  where c.celular_normalizado = v_normalizado
    and c.activo = true
    and c.autoriza_fidelizacion = true
  limit 1;

  if v_cliente.id is null then
    return;
  end if;

  select * into v_cfg from loyalty_program_config(v_cliente.tienda_id);
  if not coalesce(v_cfg.activo, false) then
    return;
  end if;

  return query
  select
    split_part(btrim(v_cliente.nombre), ' ', 1),
    coalesce(la.stamps_balance, 0)::int,
    v_cfg.sellos_para_recompensa::int,
    coalesce(r.disponibles, 0)::int,
    r.valor_max,
    r.proxima_exp
  from (select 1) seed
  left join loyalty_accounts la
    on la.tienda_id = v_cliente.tienda_id and la.cliente_id = v_cliente.id
  left join lateral (
    select
      count(*)::int as disponibles,
      max(lr.reward_value_cop) as valor_max,
      min(lr.expires_at) as proxima_exp
    from loyalty_rewards lr
    where lr.tienda_id = v_cliente.tienda_id
      and lr.cliente_id = v_cliente.id
      and lr.status = 'available'
      and lr.expires_at > now()
  ) r on true;
end;
$$;

comment on function public.storefront_club_progress(text) is
  'Consulta pública del progreso MOVE ON Club por celular (ADR 0016). Proyección mínima: primer nombre, sellos y recompensas vigentes. Sin oráculo de existencia. Ampliar la proyección requiere ADR nuevo.';

revoke execute on function public.storefront_club_progress(text) from public;
grant execute on function public.storefront_club_progress(text) to anon, authenticated;
