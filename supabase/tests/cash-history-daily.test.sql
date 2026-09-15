begin;
create extension if not exists pgtap;
select plan(16);
insert into auth.users(id,email) values ('c1222222-2222-4222-8222-222222222222','daily@local.test');
insert into public.tiendas(id,nombre,timezone) values ('c1111111-1111-4111-8111-111111111111','Daily test','America/Bogota'),('c1333333-3333-4333-8333-333333333333','Other day','America/Bogota');
insert into public.user_tiendas(user_id,tienda_id,rol,is_active) values ('c1222222-2222-4222-8222-222222222222','c1111111-1111-4111-8111-111111111111','admin',true);
insert into public.cash_sessions(id,tienda_id,opened_by,closed_by,closed_by_email,status,opening_amount,actual_cash_amount,expected_cash_amount,closing_withdrawal_amount,cash_left_amount,difference,sales_difference,expected_sales_amount,payment_closure,opened_at,closed_at) values
('c1444444-4444-4444-8444-444444444444','c1111111-1111-4111-8111-111111111111','c1222222-2222-4222-8222-222222222222','c1222222-2222-4222-8222-222222222222','daily@local.test','closed',100000,90000,90000,0,90000,0,0,30000,'{"expected":[{"metodo":"cash","total":15000},{"metodo":"transfer","total":15000}]}','2026-09-13T12:00Z','2026-09-14T03:00Z'),
('c1555555-5555-4555-8555-555555555555','c1111111-1111-4111-8111-111111111111','c1222222-2222-4222-8222-222222222222','c1222222-2222-4222-8222-222222222222','daily@local.test','closed',90000,100000,100000,20000,80000,0,0,20000,'{"expected":[{"metodo":"cash","total":10000},{"metodo":"transfer","total":10000}]}','2026-09-14T03:00Z','2026-09-14T04:00Z');
insert into public.cash_movements(cash_session_id,tipo,amount,motivo,created_by,status) values
('c1444444-4444-4444-8444-444444444444','expense',5000,'Hielo test','c1222222-2222-4222-8222-222222222222','active'),
('c1444444-4444-4444-8444-444444444444','cash_in',2000,'Ingreso test','c1222222-2222-4222-8222-222222222222','active'),
('c1444444-4444-4444-8444-444444444444','expense',99999,'Anulado test','c1222222-2222-4222-8222-222222222222','voided');
select set_config('request.jwt.claim.sub','c1222222-2222-4222-8222-222222222222',true);
update public.cash_sessions set difference=5000 where id='c1555555-5555-4555-8555-555555555555';
insert into public.cash_sessions(id,tienda_id,opened_by,closed_by,status,opening_amount,actual_cash_amount,closing_withdrawal_amount,cash_left_amount,opened_at,closed_at)
values ('c1666666-6666-4666-8666-666666666666','c1333333-3333-4333-8333-333333333333','c1222222-2222-4222-8222-222222222222','c1222222-2222-4222-8222-222222222222','closed',100000,100000,0,100000,'2026-09-13T12:00Z','2026-09-14T03:00Z');
set local role authenticated;
create temporary table daily_result as select * from public.list_cash_history_days('c1111111-1111-4111-8111-111111111111','2026-09-13T05:00Z','2026-09-14T05:00Z',null,'all',1,20);
select is((select day::text from daily_result),'2026-09-13','fecha local, no UTC');
select is((select turn_count from daily_result),2,'agrupa turnos');
select is((select sales_total from daily_result),50000::numeric,'suma ventas sin fan-out');
select is((select cash_total from daily_result),25000::numeric,'suma efectivo');
select is((select transfer_total from daily_result),25000::numeric,'suma transferencia');
select is((select opening_amount from daily_result),100000::numeric,'solo primera apertura');
select is((select final_cash_left from daily_result),80000::numeric,'solo último saldo');
select is((select expenses_total from daily_result),5000::numeric,'excluye anulados');
select is((select extra_income_total from daily_result),2000::numeric,'ingreso extra');
select is((select count(*)::integer from public.list_cash_history_days('c1333333-3333-4333-8333-333333333333','2026-09-13T05:00Z','2026-09-14T05:00Z',null,'all',1,20)),0,'aislamiento de tienda');
reset role;
select is((select withdrawals_total from daily_result),20000::numeric,'retiros de cierre se suman como flujos');
select is((select total_days from daily_result),1::bigint,'conteo de días no de turnos');
select is((select final_cash_left from public.list_cash_history_days('c1111111-1111-4111-8111-111111111111','2026-09-13T05:00Z','2026-09-14T05:00Z',null,'balanced',1,20)),80000::numeric,'filtro no altera saldo físico del día');
select throws_ok($$select * from public.list_cash_history_days('c1111111-1111-4111-8111-111111111111','2026-09-13T05:00Z','2026-09-14T05:00Z',null,'all',0,20)$$,'P0001','Paginación inválida','rechaza páginas inválidas');
select function_privs_are('public','list_cash_history_days',array['uuid','timestamp with time zone','timestamp with time zone','uuid','text','integer','integer'],'anon',array[]::text[]);
update public.user_tiendas set rol='cajero' where user_id='c1222222-2222-4222-8222-222222222222';
set local role authenticated;
select is((select count(*)::integer from public.list_cash_history_days('c1111111-1111-4111-8111-111111111111','2026-09-13T05:00Z','2026-09-14T05:00Z',null,'all',1,20)),0,'cajero no consulta resumen administrativo');
reset role;
select * from finish();
rollback;
