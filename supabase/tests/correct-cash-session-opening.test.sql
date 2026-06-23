-- =====================================================
-- pgTAP: correct_cash_session_opening_atomic (PLAN-44)
-- =====================================================
-- Cómo correr (requiere Supabase CLI + Docker):
--   supabase test db --file supabase/tests/correct-cash-session-opening.test.sql
--
-- pgTAP no está instalado por defecto en proyectos Supabase.
-- Si la primera ejecución falla con "extension pgtap not found":
--   psql "$SUPABASE_DB_URL" -c "create extension if not exists pgtap"
--
-- Verifica la corrección auditada de `cash_sessions.opening_amount`:
-- cualquier usuario activo de la tienda (no solo `opened_by`) puede corregir
-- mientras la sesión sigue `open`; queda un registro en `audit_logs` con
-- old_amount/new_amount/reason; se rechazan sesiones cerradas, motivos
-- cortos, montos negativos, correcciones sin cambio real (no-op), usuarios
-- de otra tienda y `auth.uid()` distinto de `p_corrected_by`.
--
-- `auth.uid()` se simula con `set_config('request.jwt.claim.sub', ..., true)`,
-- mismo patrón ya probado en supabase/tests/sale-discount.test.sql e
-- inventory-locations.test.sql (no el workaround de pass() documentado en
-- cash-session-shared.test.sql, que predata este patrón).
--
-- Corre dentro de una transacción con rollback.
-- =====================================================

begin;

create extension if not exists pgtap;

select plan(9);

-- ----------------- Setup -----------------
-- 1 tienda con 2 usuarios activos (admin abre la sesión, cajero corrige),
-- 1 sesión `open`, 1 tienda B con su propio usuario para los casos de
-- aislamiento por tienda / auth.uid() mismatch, y 1 sesión `closed` para
-- el caso de rechazo.

do $$
declare
  v_tienda_id     uuid := 'e1111111-1111-1111-1111-111111111111';
  v_admin         uuid := 'e2222222-2222-2222-2222-222222222222';
  v_cajero        uuid := 'e2222222-2222-2222-2222-222222222223';
  v_session_id    uuid := 'e3333333-3333-3333-3333-333333333333';
  v_closed_id     uuid := 'e3333333-3333-3333-3333-333333333334';
  v_tienda_b      uuid := 'f1111111-1111-1111-1111-111111111111';
  v_user_b        uuid := 'f2222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_admin,  'pgtap-co-admin@local.test',  '{}'::jsonb),
         (v_cajero, 'pgtap-co-cajero@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_id, 'pgTAP Tienda Correccion Apertura');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_admin,  v_tienda_id, 'admin',  true),
         (v_cajero, v_tienda_id, 'cajero', true);

  -- Sesión open abierta por el ADMIN; el cajero (no opened_by) la corrige.
  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status)
  values (v_session_id, v_tienda_id, v_admin, 100000, 'open');

  -- Sesión ya cerrada, para el caso de rechazo.
  insert into public.cash_sessions (id, tienda_id, opened_by, opening_amount, status, closed_by, closed_at)
  values (v_closed_id, v_tienda_id, v_admin, 50000, 'closed', v_admin, now());

  -- Tienda B con un usuario activo que NO pertenece a la tienda A.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_b, 'pgtap-co-b@local.test', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.tiendas (id, nombre)
  values (v_tienda_b, 'pgTAP Tienda Correccion B');

  insert into public.user_tiendas (user_id, tienda_id, rol, is_active)
  values (v_user_b, v_tienda_b, 'admin', true);
end $$;

-- ----------------- Tests -----------------

-- 1. Un usuario activo de la tienda que NO es `opened_by` (el cajero) puede
--    corregir la apertura (prueba el gate de caja compartida, no owner-only).
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222223', true);

prepare correccion_cajero as
  select public.correct_cash_session_opening_atomic(
    'e3333333-3333-3333-3333-333333333333'::uuid,  -- sesión abierta por el ADMIN
    'e1111111-1111-1111-1111-111111111111'::uuid,  -- tienda
    150000,                                          -- nuevo monto
    'e2222222-2222-2222-2222-222222222223'::uuid,  -- p_corrected_by = CAJERO (no es opened_by)
    'Se digito mal el monto de apertura del turno'
  );

select isnt(execute('correccion_cajero')::text, '',
  'caja compartida: el cajero corrige la apertura de la sesión que abrió el admin (retorna UUID)');

-- 2. opening_amount refleja el nuevo valor.
select is(
  (select opening_amount from public.cash_sessions where id = 'e3333333-3333-3333-3333-333333333333'::uuid),
  150000::numeric,
  'cash_sessions.opening_amount queda en 150000 tras la corrección'
);

-- 3. Se inserta una fila en audit_logs con la acción y metadata esperadas.
select is(
  (select count(*)::int from public.audit_logs
   where tienda_id = 'e1111111-1111-1111-1111-111111111111'::uuid
     and entity_id  = 'e3333333-3333-3333-3333-333333333333'
     and entity_type = 'cash_session'
     and action = 'cash_session.opening_corrected'
     and metadata->>'old_amount' = '100000'
     and metadata->>'new_amount' = '150000'
     and metadata->>'reason' = 'Se digito mal el monto de apertura del turno'),
  1,
  'audit_logs registra old_amount/new_amount/reason de la corrección'
);

-- 4. Llamar el RPC sobre una sesión `closed` lanza excepción (admin autenticado).
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333334'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      99999,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'Intento de corregir una sesion ya cerrada'
    )
  $$,
  'Solo se puede corregir la apertura mientras la caja esta abierta',
  'rechaza la corrección sobre una sesión ya cerrada'
);

-- 5. Motivo menor a 10 caracteres lanza excepción.
select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333333'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      160000,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'corto'
    )
  $$,
  'El motivo debe tener al menos 10 caracteres',
  'rechaza un motivo de menos de 10 caracteres'
);

-- 6. Monto negativo lanza excepción.
select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333333'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      -1000,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'Monto negativo invalido para apertura'
    )
  $$,
  'El monto de apertura no puede ser negativo',
  'rechaza un monto de apertura negativo'
);

-- 7. Nuevo monto igual al actual (no-op) lanza excepción.
--    Tras el test 1, opening_amount quedó en 150000.
select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333333'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      150000,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'Intento de correccion sin cambio real de monto'
    )
  $$,
  'El nuevo monto es igual al actual',
  'rechaza una corrección no-op (nuevo monto = monto actual)'
);

-- 8. Un usuario activo de OTRA tienda no puede corregir la sesión de la
--    tienda A (gate de tienda: user_tiendas con tienda_id = p_tienda_id).
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333333'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      170000,
      'f2222222-2222-2222-2222-222222222222'::uuid,
      'Usuario de otra tienda intenta corregir'
    )
  $$,
  'Solo un usuario activo de la tienda puede corregir esta caja',
  'un usuario activo de otra tienda no puede corregir esta sesión'
);

-- 9. auth.uid() distinto de p_corrected_by lanza 'No autenticado'.
--    auth.uid() sigue simulado como el usuario de la tienda B (test 8);
--    se llama con p_corrected_by = admin de la tienda A (no coincide).
select throws_ok(
  $$
    select public.correct_cash_session_opening_atomic(
      'e3333333-3333-3333-3333-333333333333'::uuid,
      'e1111111-1111-1111-1111-111111111111'::uuid,
      170000,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'Suplantando a otro usuario via p_corrected_by'
    )
  $$,
  'No autenticado',
  'auth.uid() distinto de p_corrected_by lanza No autenticado'
);

select * from finish();

rollback;
