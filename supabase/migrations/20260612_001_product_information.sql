-- Informacion comercial visible para orientar la recomendacion en el POS.
alter table public.productos
  add column if not exists para_que_sirve text,
  add column if not exists recomendado_para text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_para_que_sirve_length'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_para_que_sirve_length
        check (para_que_sirve is null or char_length(para_que_sirve) <= 800);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_recomendado_para_length'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_recomendado_para_length
        check (recomendado_para is null or char_length(recomendado_para) <= 800);
  end if;
end
$$;

comment on column public.productos.para_que_sirve is
  'Resumen comercial basado en la ficha oficial: finalidad y beneficios del producto.';

comment on column public.productos.recomendado_para is
  'Perfil de cliente al que se puede orientar el producto segun la ficha oficial.';
