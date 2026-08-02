-- =====================================================
-- Triggers de auditoría — auditoría 2026-05-08 (A6)
-- =====================================================
-- Hoy `audit_logs` solo se llena desde `void_sale_atomic`.
-- Esta migración agrega triggers para mutaciones sensibles que
-- antes quedaban sin rastro:
--   - productos: cambio de precio_venta o costo
--   - inventory_movements: ajustes manuales (`adjustment`)
--
-- El trigger es defensivo: si auth.uid() es null (ej. job de mantenimiento)
-- registra `null` en user_id sin fallar.
-- =====================================================

create or replace function public.tg_audit_producto_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.precio_venta is distinct from old.precio_venta
     or new.costo is distinct from old.costo then
    insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
    values (
      new.tienda_id,
      auth.uid(),
      'product.price_changed',
      'product',
      new.id,
      jsonb_build_object(
        'precio_venta', jsonb_build_object('from', old.precio_venta, 'to', new.precio_venta),
        'costo',        jsonb_build_object('from', old.costo,        'to', new.costo)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_audit_productos_price on public.productos;
create trigger tr_audit_productos_price
  after update of precio_venta, costo on public.productos
  for each row
  execute function public.tg_audit_producto_price();

create or replace function public.tg_audit_inventory_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'adjustment' then
    insert into public.audit_logs (tienda_id, user_id, action, entity_type, entity_id, metadata)
    values (
      new.tienda_id,
      auth.uid(),
      'inventory.adjusted',
      'product',
      new.producto_id,
      jsonb_build_object(
        'cantidad', new.cantidad,
        'motivo',   new.motivo
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_audit_inventory_adjustment on public.inventory_movements;
create trigger tr_audit_inventory_adjustment
  after insert on public.inventory_movements
  for each row
  execute function public.tg_audit_inventory_adjustment();
