-- Ejecutar con psql -v ON_ERROR_STOP=1. Todo se revierte al terminar.
begin;
do $$
declare
  t uuid := gen_random_uuid();
  other_t uuid := gen_random_uuid();
  u uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  balance int;
begin
  insert into auth.users(id, email) values(u, u::text || '@loyalty-test.invalid');
  insert into public.tiendas(id, nombre) values(t, 'Prueba ajuste cajero'),(other_t, 'Otra tienda prueba');
  insert into public.user_tiendas(user_id, tienda_id, rol, is_active) values(u,t,'cajero',true);
  insert into public.clientes(id, tienda_id, nombre) values(c,t,'Cliente prueba ajuste');
  perform set_config('request.jwt.claim.sub',u::text,true);
  balance := public.adjust_loyalty_stamps(t,c,3,'Prueba suma cajero',u);
  if balance <> 3 then raise exception 'Saldo incorrecto al sumar: %',balance; end if;
  balance := public.adjust_loyalty_stamps(t,c,-1,'Prueba resta cajero',u);
  if balance <> 2 then raise exception 'Saldo incorrecto al restar: %',balance; end if;
  if (select count(*) from public.loyalty_transactions where cliente_id=c and type='adjustment' and created_by=u and reason is not null) <> 2 then
    raise exception 'Ledger incompleto';
  end if;
  if (select count(*) from public.audit_logs where entity_id=c and user_id=u and action='loyalty.stamps_adjusted') <> 2 then
    raise exception 'Auditoría incompleta';
  end if;
  begin
    perform public.adjust_loyalty_stamps(other_t,c,1,'Otra tienda',u);
    raise exception 'Se permitió otra tienda';
  exception when others then
    if sqlerrm <> 'No autorizado para ajustar sellos en esta tienda' then raise; end if;
  end;
  update public.user_tiendas set is_active=false where user_id=u and tienda_id=t;
  begin
    perform public.adjust_loyalty_stamps(t,c,1,'Usuario inactivo',u);
    raise exception 'Se permitió usuario inactivo';
  exception when others then
    if sqlerrm <> 'No autorizado para ajustar sellos en esta tienda' then raise; end if;
  end;
  update public.user_tiendas set is_active=true where user_id=u and tienda_id=t;
  begin
    perform public.adjust_loyalty_stamps(t,c,1,'Motivo',gen_random_uuid());
    raise exception 'Se permitió suplantación';
  exception when others then
    if sqlerrm <> 'No autenticado' then raise; end if;
  end;
  begin
    perform public.adjust_loyalty_stamps(t,c,1,'ab',u);
    raise exception 'Se permitió motivo corto';
  exception when others then
    if sqlerrm <> 'El motivo del ajuste es obligatorio' then raise; end if;
  end;
  update public.user_tiendas set rol='admin' where user_id=u and tienda_id=t;
  balance := public.adjust_loyalty_stamps(t,c,1,'Prueba admin',u);
  if balance <> 3 then raise exception 'Regresión permiso admin'; end if;
end $$;
rollback;
