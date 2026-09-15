-- Seguimiento diario: flujos sumados, saldos físicos del primer/último turno.
create or replace function public.list_cash_history_days(
 p_tienda_id uuid, p_start timestamptz, p_end timestamptz,
 p_closed_by uuid, p_balance text, p_page integer, p_page_size integer
) returns table (
 day date, turn_count integer, sales_total numeric, cash_total numeric,
 transfer_total numeric, expenses_total numeric, extra_income_total numeric,
 withdrawals_total numeric, opening_amount numeric, final_cash_left numeric,
 notes text[], total_days bigint
)
language plpgsql stable security invoker set search_path = public, pg_temp
as $$
begin
 if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 100 then
   raise exception 'Paginación inválida';
 end if;
 if p_balance is null or p_balance not in ('all','balanced','difference') or p_start is null or p_end is null or p_start >= p_end then
   raise exception 'Filtros inválidos';
 end if;
 return query
 with all_sessions as (
   select cs.*, (cs.closed_at at time zone coalesce(t.timezone,'America/Bogota'))::date as local_day
   from public.cash_sessions cs join public.tiendas t on t.id = cs.tienda_id
   where cs.tienda_id = p_tienda_id and cs.status = 'closed'
     and cs.closed_at >= p_start and cs.closed_at < p_end
     and exists (select 1 from public.user_tiendas ut where ut.user_id = (select auth.uid())
       and ut.tienda_id = p_tienda_id and ut.rol = 'admin' and ut.is_active)
 ), selected as (
   select s.* from all_sessions s
   where (p_closed_by is null or s.closed_by = p_closed_by)
   and (p_balance = 'all' or
      (p_balance = 'balanced' and s.difference = 0 and s.sales_difference = 0) or
      (p_balance = 'difference' and (s.difference <> 0 or s.sales_difference <> 0)))
 ), per_session as (
   select s.*, pay.cash, pay.transfer, mov.expenses, mov.extras, mov.cash_out
   from selected s
   cross join lateral (
     select coalesce(sum((v->>'total')::numeric) filter(where v->>'metodo' = 'cash'),0) as cash,
       coalesce(sum((v->>'total')::numeric) filter(where v->>'metodo' = 'transfer'),0) as transfer
     from jsonb_array_elements(case when jsonb_typeof(s.payment_closure->'expected') = 'array'
       then s.payment_closure->'expected' else '[]'::jsonb end) v
   ) pay
   cross join lateral (
     select coalesce(sum(m.amount) filter(where m.tipo = 'expense'),0) as expenses,
       coalesce(sum(m.amount) filter(where m.tipo = 'cash_in'),0) as extras,
       coalesce(sum(m.amount) filter(where m.tipo = 'cash_out'),0) as cash_out
     from public.cash_movements m where m.cash_session_id = s.id and m.status = 'active'
   ) mov
 ), physical as (
   select s.local_day,
     (array_agg(s.opening_amount order by s.opened_at,s.id))[1] as initial,
     (array_agg(s.cash_left_amount order by s.closed_at desc,s.id desc))[1] as final
   from all_sessions s group by s.local_day
 ), days as (
   select s.local_day, count(*)::integer as turns, sum(s.expected_sales_amount) as sales,
     sum(s.cash) as cash, sum(s.transfer) as transfer, sum(s.expenses) as expenses,
     sum(s.extras) as extras, sum(s.cash_out + coalesce(s.closing_withdrawal_amount,0)) as withdrawals,
     array_remove(array_agg(nullif(btrim(s.notas_cierre),'') order by s.closed_at,s.id),null) as comments
   from per_session s group by s.local_day
 )
 select d.local_day,d.turns,d.sales,d.cash,d.transfer,d.expenses,d.extras,d.withdrawals,
   p.initial,p.final,d.comments,count(*) over()
 from days d join physical p on p.local_day = d.local_day
 order by d.local_day desc
 limit p_page_size offset ((p_page::bigint - 1) * p_page_size);
end;
$$;
revoke execute on function public.list_cash_history_days(uuid,timestamptz,timestamptz,uuid,text,integer,integer) from public,anon;
grant execute on function public.list_cash_history_days(uuid,timestamptz,timestamptz,uuid,text,integer,integer) to authenticated;
