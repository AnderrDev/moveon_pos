-- =====================================================
-- pgTAP: retiro opcional al cierre de caja
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(22);

do $$
declare
  v_tienda_id uuid := 'a7111111-1111-4111-8111-111111111111';
  v_admin     uuid := 'a7222222-2222-4222-8222-222222222222';
  v_cajero   uuid := 'a7333333-3333-4333-8333-333333333333';
  v_externo  uuid := 'a7444444-4444-4444-8444-444444444444';
  v_tienda_b uuid := 'a7555555-5555-4555-8555-555555555555';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_admin, 'closing-admin@local.test', '{}'::jsonb),
    (v_cajero, 'closing-cajero@local.test', '{}'::jsonb),
    (v_externo, 'closing-externo@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values
    (v_tienda_id, 'pgTAP Retiro Cierre'),
    (v_tienda_b, 'pgTAP Retiro Externo');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values
    (v_admin, v_tienda_id, 'admin', true),
    (v_cajero, v_tienda_id, 'cajero', true),
    (v_externo, v_tienda_b, 'admin', true);
end $$;

-- Cierre sin retiro: $100.000 de apertura + $50.000 de ingreso.
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
values (
  'a7611111-1111-4611-8611-111111111111',
  'a7111111-1111-4111-8111-111111111111',
  'a7222222-2222-4222-8222-222222222222',
  100000,
  'open'
);

insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
values (
  'a7611111-1111-4611-8611-111111111111',
  'cash_in',
  50000,
  'Ingreso adicional para prueba',
  'a7222222-2222-4222-8222-222222222222'
);

select set_config('request.jwt.claim.sub', 'a7333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$
    select public.close_cash_session_atomic(
      'a7611111-1111-4611-8611-111111111111',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      150000,
      150000,
      '[]'::jsonb,
      null
    )
  $$,
  'un cajero activo puede cerrar sin retirar efectivo'
);

select is(
  (select closing_withdrawal_amount from public.cash_sessions
   where id = 'a7611111-1111-4611-8611-111111111111'),
  0::numeric,
  'sin retiro guarda closing_withdrawal_amount en cero'
);

select is(
  (select cash_left_amount from public.cash_sessions
   where id = 'a7611111-1111-4611-8611-111111111111'),
  150000::numeric,
  'sin retiro deja todo el efectivo contado'
);

select is(
  (select difference from public.cash_sessions
   where id = 'a7611111-1111-4611-8611-111111111111'),
  0::numeric,
  'sin retiro calcula la diferencia contra el conteo previo'
);

select is(
  (select count(*)::int from public.audit_logs
   where entity_id = 'a7611111-1111-4611-8611-111111111111'
     and action = 'cash_session.closed'
     and metadata->>'actual_cash_amount' = '150000'
     and metadata->>'closing_withdrawal_amount' = '0'
     and metadata->>'cash_left_amount' = '150000'),
  1,
  'audita el conteo, retiro y efectivo dejado sin retiro'
);

-- Cierre con retiro parcial: se cuentan $480.000 y se dejan $150.000.
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
values (
  'a7622222-2222-4622-8622-222222222222',
  'a7111111-1111-4111-8111-111111111111',
  'a7222222-2222-4222-8222-222222222222',
  150000,
  'open'
);

insert into public.cash_movements (cash_session_id, tipo, amount, motivo, created_by)
values (
  'a7622222-2222-4622-8622-222222222222',
  'cash_in',
  330000,
  'Ingreso adicional para retiro parcial',
  'a7222222-2222-4222-8222-222222222222'
);

select lives_ok(
  $$
    select public.close_cash_session_atomic(
      'a7622222-2222-4622-8622-222222222222',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      480000,
      150000,
      '[]'::jsonb,
      null
    )
  $$,
  'un cajero activo puede cerrar con retiro parcial'
);

select is(
  (select closing_withdrawal_amount from public.cash_sessions
   where id = 'a7622222-2222-4622-8622-222222222222'),
  330000::numeric,
  'calcula el retiro parcial desde contado menos dejado'
);

select is(
  (select cash_left_amount from public.cash_sessions
   where id = 'a7622222-2222-4622-8622-222222222222'),
  150000::numeric,
  'guarda el efectivo dejado después del retiro parcial'
);

select is(
  (select difference from public.cash_sessions
   where id = 'a7622222-2222-4622-8622-222222222222'),
  0::numeric,
  'el retiro parcial no altera la diferencia del turno'
);

select is(
  (select count(*)::int from public.audit_logs
   where entity_id = 'a7622222-2222-4622-8622-222222222222'
     and action = 'cash_session.closed'
     and user_id = 'a7333333-3333-4333-8333-333333333333'
     and metadata->>'closing_withdrawal_amount' = '330000'
     and metadata->>'cash_left_amount' = '150000'),
  1,
  'audita retiro parcial y responsable del cierre'
);

-- Los intentos inválidos deben dejar la sesión abierta e intacta.
insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
values (
  'a7633333-3333-4633-8633-333333333333',
  'a7111111-1111-4111-8111-111111111111',
  'a7222222-2222-4222-8222-222222222222',
  100000,
  'open'
);

select throws_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      100000,
      100001,
      '[]'::jsonb,
      null
    )
  $$,
  'El efectivo dejado no puede superar el efectivo contado',
  'rechaza dejar más efectivo del contado'
);

select throws_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      100000,
      -1,
      '[]'::jsonb,
      null
    )
  $$,
  'El efectivo dejado no puede ser negativo',
  'rechaza efectivo dejado negativo'
);

select throws_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      null,
      0,
      '[]'::jsonb,
      null
    )
  $$,
  'El efectivo contado es obligatorio',
  'rechaza efectivo contado nulo'
);

select throws_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      100000,
      null,
      '[]'::jsonb,
      null
    )
  $$,
  'El efectivo dejado es obligatorio',
  'rechaza efectivo dejado nulo'
);

select is(
  has_table_privilege('authenticated', 'public.cash_sessions', 'UPDATE'),
  false,
  'authenticated no puede modificar cash_sessions directamente'
);

select is(
  has_table_privilege('anon', 'public.cash_sessions', 'UPDATE'),
  false,
  'anon no puede modificar cash_sessions directamente'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7333333-3333-4333-8333-333333333333', true);

select throws_ok(
  $$
    insert into public.cash_sessions (
      id,
      tienda_id,
      opened_by,
      closed_by,
      status,
      opening_amount,
      actual_cash_amount,
      closing_withdrawal_amount,
      cash_left_amount,
      closed_at
    ) values (
      'a7644444-4444-4644-8644-444444444444',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      'a7333333-3333-4333-8333-333333333333',
      'closed',
      100000,
      100000,
      0,
      100000,
      now()
    )
  $$,
  '42501',
  'new row violates row-level security policy "cash_sessions_open_insert_only" for table "cash_sessions"',
  'authenticated no puede fabricar una sesión cerrada sin RPC'
);

reset role;
select set_config('request.jwt.claim.sub', 'a7333333-3333-4333-8333-333333333333', true);

select is(
  (select concat_ws('|', status::text, closing_withdrawal_amount::text, cash_left_amount::text)
   from public.cash_sessions
   where id = 'a7633333-3333-4633-8633-333333333333'),
  'open',
  'un cierre inválido no modifica la sesión'
);

select set_config('request.jwt.claim.sub', 'a7444444-4444-4444-8444-444444444444', true);

select throws_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7444444-4444-4444-8444-444444444444',
      100000,
      100000,
      '[]'::jsonb,
      null
    )
  $$,
  'Solo un usuario activo de la tienda puede cerrar esta caja',
  'rechaza a un usuario que no pertenece a la tienda'
);

select set_config('request.jwt.claim.sub', 'a7333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$
    select public.close_cash_session_atomic(
      'a7633333-3333-4633-8633-333333333333',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      100000,
      100000,
      '[]'::jsonb,
      null
    )
  $$,
  'la sesión sigue disponible para un cierre válido tras los rechazos'
);

select is(
  (select status::text from public.cash_sessions
   where id = 'a7633333-3333-4633-8633-333333333333'),
  'closed',
  'el cierre válido finaliza la sesión una sola vez'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$
    insert into public.cash_sessions (
      id,
      tienda_id,
      opened_by,
      opening_amount,
      status
    ) values (
      'a7655555-5555-4655-8655-555555555555',
      'a7111111-1111-4111-8111-111111111111',
      'a7333333-3333-4333-8333-333333333333',
      100000,
      'open'
    )
  $$,
  'authenticated conserva el INSERT legítimo de apertura'
);

reset role;

select * from finish();

rollback;
