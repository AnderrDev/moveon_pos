begin;
create extension if not exists pgtap;
select plan(12);

select has_column('public', 'cash_sessions', 'closed_by_email', 'snapshot existe');
select col_type_is('public', 'cash_sessions', 'closed_by_email', 'text', 'snapshot de tipo texto');
select has_function('public', 'list_cash_session_closers', array['uuid']);
select function_privs_are('public', 'list_cash_session_closers', array['uuid'], 'authenticated', array['EXECUTE']);
select function_privs_are('public', 'list_cash_session_closers', array['uuid'], 'anon', array[]::text[]);

insert into auth.users (id, email, raw_user_meta_data) values
('b1222222-2222-4222-8222-222222222222', 'closer@moveon.test', '{}'::jsonb),
('b1333333-3333-4333-8333-333333333333', 'external@moveon.test', '{}'::jsonb);
insert into public.tiendas (id, nombre) values
('b1111111-1111-4111-8111-111111111111', 'Historial test'),
('b1444444-4444-4444-8444-444444444444', 'Historial externo');
insert into public.user_tiendas (user_id, tienda_id, rol, is_active) values
('b1222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111', 'admin', true),
('b1333333-3333-4333-8333-333333333333', 'b1444444-4444-4444-8444-444444444444', 'admin', true);
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount) values
('b1555555-5555-4555-8555-555555555555', 'b1111111-1111-4111-8111-111111111111', 'b1222222-2222-4222-8222-222222222222', 100000),
('b1666666-6666-4666-8666-666666666666', 'b1444444-4444-4444-8444-444444444444', 'b1333333-3333-4333-8333-333333333333', 100000);
select set_config('request.jwt.claim.sub', 'b1333333-3333-4333-8333-333333333333', true);
select public.close_cash_session_atomic('b1666666-6666-4666-8666-666666666666', 'b1444444-4444-4444-8444-444444444444', 'b1333333-3333-4333-8333-333333333333', 100000, 100000, '[]'::jsonb, null);
select set_config('request.jwt.claim.sub', 'b1222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"b1222222-2222-4222-8222-222222222222","email":"closer@moveon.test","role":"authenticated"}', true);
select lives_ok($$select public.close_cash_session_atomic('b1555555-5555-4555-8555-555555555555', 'b1111111-1111-4111-8111-111111111111', 'b1222222-2222-4222-8222-222222222222', 100000, 80000, '[]'::jsonb, null)$$, 'cierre con snapshot autenticado');
select is((select closed_by_email from public.cash_sessions where id='b1555555-5555-4555-8555-555555555555'), 'closer@moveon.test', 'guarda correo del cierre');
select is((select closed_by_email from public.cash_sessions where id='b1666666-6666-4666-8666-666666666666'), 'external@moveon.test', 'fallback usa auth.users');
update auth.users set email='changed@moveon.test' where id='b1222222-2222-4222-8222-222222222222';
select is((select closed_by_email from public.cash_sessions where id='b1555555-5555-4555-8555-555555555555'), 'closer@moveon.test', 'snapshot no cambia con el perfil');
set local role authenticated;
select results_eq($$select email from public.list_cash_session_closers('b1111111-1111-4111-8111-111111111111')$$, $$values ('closer@moveon.test'::text)$$, 'responsable visible en tienda propia');
select is((select count(*)::int from public.list_cash_session_closers('b1444444-4444-4444-8444-444444444444')), 0, 'no expone otra tienda');
select is((select count(*)::int from public.list_cash_session_closers('b1111111-1111-4111-8111-111111111111')), 1, 'sin responsables duplicados');
reset role;
select * from finish();
rollback;
