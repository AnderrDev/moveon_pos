-- 20260723010000: RPC correct_sale_customer_atomic
-- Permite asociar retroactivamente un cliente a una venta que se completó
-- sin cliente (se olvidó en el cobro), igual que correct_payment_atomic
-- corrige el método de pago. Alcance deliberadamente acotado: solo cubre
-- el caso "cliente_id era null" — reasignar de un cliente A a un cliente B
-- no está soportado (revertir los sellos ya otorgados a A es un caso
-- distinto, fuera de este alcance).
--
-- Si el producto participaba en fidelización, otorga los sellos que la
-- venta hubiera ganado en el momento del cobro (misma elegibilidad que
-- create_sale_atomic: RN-LF01/02/05 en docs/modules/loyalty.md), sujeto
-- a que el cliente esté activo y haya autorizado fidelización y el
-- programa siga activo. Nota: participa_fidelizacion se evalúa contra el
-- estado ACTUAL del producto (sale_items no guarda una foto histórica de
-- ese flag), consistente con cómo ya funciona adjust_loyalty_stamps.

create or replace function public.correct_sale_customer_atomic(
  p_sale_id uuid,
  p_tienda_id uuid,
  p_cliente_id uuid,
  p_corrected_by uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sale_number text;
  v_stamps int := 0;
  v_cliente record;
  v_cfg record;
begin
  if auth.uid() is null or auth.uid() <> p_corrected_by then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.user_tiendas
    where user_id = auth.uid()
      and tienda_id = p_tienda_id
      and rol = 'admin'
      and is_active = true
  ) then
    raise exception 'Solo el admin puede corregir el cliente de una venta';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and tienda_id = p_tienda_id and activo = true
  ) then
    raise exception 'Cliente no encontrado o inactivo';
  end if;

  update public.sales
  set cliente_id = p_cliente_id
  where id = p_sale_id
    and tienda_id = p_tienda_id
    and status = 'completed'
    and cliente_id is null
  returning sale_number into v_sale_number;

  if v_sale_number is null then
    raise exception 'Venta no encontrada, anulada, o ya tiene un cliente asociado';
  end if;

  insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, changes)
  values (
    p_tienda_id,
    p_corrected_by,
    'sale.customer_corrected',
    'sale',
    p_sale_id,
    jsonb_build_object(
      'cliente_id',  p_cliente_id,
      'reason',      btrim(p_reason),
      'sale_number', v_sale_number
    )
  );

  select coalesce(sum(
    greatest(
      0,
      floor(si.quantity)::int - case when si.loyalty_reward_id is not null then 1 else 0 end
    )
  ), 0)
  into v_stamps
  from public.sale_items si
  join public.productos p on p.id = si.producto_id
  where si.sale_id = p_sale_id
    and p.participa_fidelizacion = true
    and si.discount_amount = 0
    and si.global_discount_amount = 0;

  if v_stamps > 0 then
    select activo, autoriza_fidelizacion into v_cliente
    from public.clientes
    where id = p_cliente_id and tienda_id = p_tienda_id;

    select * into v_cfg from public.loyalty_program_config(p_tienda_id);

    if v_cfg.activo
       and coalesce(v_cliente.activo, false)
       and coalesce(v_cliente.autoriza_fidelizacion, false) then
      perform public.loyalty_apply_delta(
        p_tienda_id, p_cliente_id, 'earn', v_stamps,
        p_sale_id, 'Corrección: cliente asociado retroactivamente a venta ' || v_sale_number,
        p_corrected_by
      );
      perform public.loyalty_generate_rewards(p_tienda_id, p_cliente_id, p_sale_id, p_corrected_by);
    end if;
  end if;
end;
$$;

revoke execute on function public.correct_sale_customer_atomic(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.correct_sale_customer_atomic(uuid, uuid, uuid, uuid, text) to authenticated;
