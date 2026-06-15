-- =====================================================
-- Componentes consumibles de productos preparados
-- =====================================================
-- Al vender un producto tipo 'prepared' (batido), el trigger
-- tg_consume_sale_components descuenta automáticamente el stock
-- de cada componente asignado (ej. vaso). Stock puede quedar
-- negativo (opción B: advertir, no bloquear).
-- =====================================================

create table public.product_components (
  id           uuid          default gen_random_uuid() primary key,
  tienda_id    uuid          not null references public.tiendas(id)   on delete cascade,
  producto_id  uuid          not null references public.productos(id)  on delete cascade,
  componente_id uuid         not null references public.productos(id)  on delete cascade,
  cantidad     numeric(10,3) not null default 1 check (cantidad > 0),
  constraint product_components_unique unique (producto_id, componente_id)
);

alter table public.product_components enable row level security;

-- Cualquier miembro activo de la tienda puede leer
create policy "pc_read" on public.product_components
  for select using (
    exists (
      select 1 from public.user_tiendas
      where user_id  = auth.uid()
        and tienda_id = product_components.tienda_id
        and is_active = true
    )
  );

-- Solo admin puede escribir
create policy "pc_admin_write" on public.product_components
  for all using (
    exists (
      select 1 from public.user_tiendas
      where user_id  = auth.uid()
        and tienda_id = product_components.tienda_id
        and is_active = true
        and rol       = 'admin'
    )
  );

-- =====================================================
-- Trigger: consumir componentes al insertar sale_item
-- =====================================================
create or replace function public.tg_consume_sale_components()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tienda_id     uuid;
  v_cashier_id    uuid;
  v_sale_number   text;
  v_producto_tipo text;
  v_component     record;
begin
  select s.tienda_id, s.cashier_id, s.sale_number, p.tipo
  into   v_tienda_id, v_cashier_id, v_sale_number, v_producto_tipo
  from   public.sales     s
  join   public.productos p on p.id = new.producto_id
  where  s.id = new.sale_id;

  -- Solo aplica a productos preparados
  if v_producto_tipo <> 'prepared' then
    return new;
  end if;

  for v_component in
    select componente_id, cantidad
    from   public.product_components
    where  producto_id = new.producto_id
      and  tienda_id   = v_tienda_id
  loop
    insert into public.inventory_movements (
      tienda_id, producto_id, tipo, cantidad, ubicacion,
      motivo, referencia_tipo, referencia_id, created_by
    ) values (
      v_tienda_id,
      v_component.componente_id,
      'sale_exit',
      -(v_component.cantidad * new.quantity),
      'punto_venta',
      'Comp. ' || v_sale_number,
      'sale',
      new.sale_id,
      v_cashier_id
    );
  end loop;

  return new;
end;
$$;

create trigger tr_consume_sale_components
  after insert on public.sale_items
  for each row
  execute function public.tg_consume_sale_components();

comment on table public.product_components is
  'Componentes consumibles de un producto preparado. Al vender el batido se generan movimientos de salida para cada componente (ej. vaso). Stock puede quedar negativo.';
comment on column public.product_components.cantidad is
  'Unidades del componente consumidas por cada unidad del producto preparado vendida.';
