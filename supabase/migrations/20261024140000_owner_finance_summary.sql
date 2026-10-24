-- =====================================================
-- owner_finance_summary: finanzas del mes para la app iOS del dueño (PLAN-83)
-- =====================================================
-- ADR 0021 §4: la app iOS no reimplementa las cuentas de `/finanzas` del POS
-- web. Replica, para el mes `p_month` en la zona de la tienda:
--   * `buildFinancialSummary` (expenses/domain/services/financial-summary.ts):
--     entradas y su desglose por método, costo de lo vendido (solo productos con
--     costo conocido), gastos activos por categoría, utilidad neta y margen;
--     las entradas y el costo salen de `owner_sales_summary`, igual que el web
--     los toma de `getDailyReport`;
--   * `buildReinvestmentFund` (reinvestment-fund.ts) sobre
--     `get_reinvestment_fund_totals`, si la tienda configuró el fondo;
--   * `buildMonthlyComparison` (monthly-comparison.ts) sobre
--     `get_monthly_sales_totals` + `get_monthly_expense_totals`, 6 meses que
--     terminan en `p_month` (el web usa los 6 que terminan en el mes actual).
-- Porcentajes como `pctOf`/`Math.round` del web: floor(x * 1000 + 0.5) / 10.
-- La paridad la prueba tests/integration/owner-finance-summary.parity.test.ts.
--
-- Solo lectura: STABLE + SECURITY INVOKER. Solo `admin` (gastos ya son admin_only).

create or replace function public.owner_finance_summary(
  p_tienda_id uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_trend_start date := (date_trunc('month', p_month) - interval '5 months')::date;
  v_sales jsonb;
  v_entradas numeric;
  v_costo numeric;
  v_gastos numeric;
  v_utilidad numeric;
  v_fund jsonb := null;
  v_settings record;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_tiendas ut
    where ut.user_id = auth.uid()
      and ut.tienda_id = p_tienda_id
      and ut.rol = 'admin'
      and ut.is_active
  ) then
    raise exception 'Solo el dueño puede ver las finanzas' using errcode = '42501';
  end if;

  if p_month is null then
    raise exception 'El mes es obligatorio' using errcode = '22023';
  end if;

  select coalesce(t.timezone, 'America/Bogota') into v_tz from public.tiendas t where t.id = p_tienda_id;
  v_tz := coalesce(v_tz, 'America/Bogota');

  -- Entradas, desglose y costo: lo mismo que el web toma de getDailyReport.
  v_sales := public.owner_sales_summary(p_tienda_id, v_month_start, v_month_end);
  v_entradas := (v_sales->>'total_ventas')::numeric;

  select sum((p->>'costo_total')::numeric)
    into v_costo
  from jsonb_array_elements(v_sales->'product_sales') p
  where p->'costo_total' <> 'null'::jsonb;

  select coalesce(sum(e.monto), 0)
    into v_gastos
  from public.expenses e
  where e.tienda_id = p_tienda_id
    and e.status = 'active'
    and e.fecha_gasto between v_month_start and v_month_end;

  v_utilidad := v_entradas - coalesce(v_costo, 0) - v_gastos;

  select s.saldo_inicial, s.fecha_inicio
    into v_settings
  from public.reinvestment_fund_settings s
  where s.tienda_id = p_tienda_id;

  if found then
    select jsonb_build_object(
      'saldo_inicial', v_settings.saldo_inicial,
      'fecha_inicio', v_settings.fecha_inicio,
      'apartado_acumulado', f.cogs_acumulado,
      'invertido_acumulado', f.compras_acumuladas,
      'disponible', v_settings.saldo_inicial + f.cogs_acumulado - f.compras_acumuladas,
      'apartado_mes', f.cogs_mes,
      'invertido_mes', f.compras_mes,
      'entradas_sin_costo', f.entradas_sin_costo
    )
      into v_fund
    from public.get_reinvestment_fund_totals(
      p_tienda_id,
      v_settings.fecha_inicio::timestamp at time zone v_tz,
      v_month_start::timestamp at time zone v_tz,
      (v_month_end + 1)::timestamp at time zone v_tz
    ) f;
  end if;

  with months as (
    select to_char(m, 'YYYY-MM') as month
    from generate_series(v_trend_start, v_month_start, interval '1 month') m
  ),
  entradas as (
    select s.month, s.total
    from public.get_monthly_sales_totals(p_tienda_id, v_trend_start::timestamp at time zone v_tz, v_tz) s
  ),
  gastos as (
    select g.month, g.total
    from public.get_monthly_expense_totals(p_tienda_id, v_trend_start) g
  ),
  trend as (
    select
      m.month,
      coalesce(en.total, 0) as entradas,
      coalesce(ga.total, 0) as gastos
    from months m
    left join entradas en on en.month = m.month
    left join gastos ga on ga.month = m.month
  )
  select jsonb_build_object(
    'month', to_char(v_month_start, 'YYYY-MM'),
    'timezone', v_tz,
    'entradas_totales', v_entradas,
    'entradas_por_metodo', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'metodo', p->>'metodo',
          'total', (p->>'total')::numeric,
          'pct_sobre_entradas', case when v_entradas > 0
            then floor((p->>'total')::numeric / v_entradas * 1000 + 0.5) / 10 end
        )
        order by array_position(array['cash', 'transfer', 'card', 'other'], p->>'metodo') nulls last,
                 (p->>'total')::numeric desc
      )
      from jsonb_array_elements(v_sales->'payment_breakdown') p
      where (p->>'total')::numeric > 0
    ), '[]'::jsonb),
    'costo_productos_vendidos', v_costo,
    'ventas_sin_costo', (
      select count(*)
      from jsonb_array_elements(v_sales->'product_sales') p
      where p->'costo_total' = 'null'::jsonb and (p->>'qty')::numeric > 0
    ),
    'unidades_sin_costo', coalesce((
      select sum((p->>'qty')::numeric)
      from jsonb_array_elements(v_sales->'product_sales') p
      where p->'costo_total' = 'null'::jsonb and (p->>'qty')::numeric > 0
    ), 0),
    'gastos_total', v_gastos,
    'por_categoria', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', c.category_id,
          'nombre', c.nombre,
          'total', c.total,
          'pct_sobre_entradas', case when v_entradas > 0 then floor(c.total / v_entradas * 1000 + 0.5) / 10 end
        )
        order by c.total desc, c.category_id
      )
      from (
        select e.category_id, coalesce(ec.nombre, 'Sin categoría') as nombre, sum(e.monto) as total
        from public.expenses e
        left join public.expense_categories ec on ec.id = e.category_id
        where e.tienda_id = p_tienda_id
          and e.status = 'active'
          and e.fecha_gasto between v_month_start and v_month_end
        group by e.category_id, ec.nombre
      ) c
    ), '[]'::jsonb),
    'pct_gastos_sobre_entradas', case when v_entradas > 0 then floor(v_gastos / v_entradas * 1000 + 0.5) / 10 end,
    'utilidad_neta', v_utilidad,
    'margen_neto', case when v_entradas > 0 then floor(v_utilidad / v_entradas * 1000 + 0.5) / 10 end,
    'fondo', v_fund,
    'tendencia', (
      select jsonb_agg(
        jsonb_build_object(
          'month', t.month,
          'entradas', t.entradas,
          'gastos', t.gastos,
          'pct_gastos', case when t.entradas > 0 then floor(t.gastos / t.entradas * 1000 + 0.5) / 10 end,
          'balance', t.entradas - t.gastos
        )
        order by t.month
      )
      from trend t
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.owner_finance_summary(uuid, date) is
  'Finanzas del mes (resumen, fondo de reinversión y 6 meses de tendencia) para la app iOS del dueño '
  '(ADR 0021, PLAN-83). Solo lectura, solo admin. Paridad con buildFinancialSummary, buildReinvestmentFund '
  'y buildMonthlyComparison del POS web.';

revoke all on function public.owner_finance_summary(uuid, date) from public, anon;
grant execute on function public.owner_finance_summary(uuid, date) to authenticated;
