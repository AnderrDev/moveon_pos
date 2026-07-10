-- ============================================================
-- CONTACTO PÚBLICO DEL CATÁLOGO
-- Permite cambiar WhatsApp e Instagram sin modificar el bundle Angular.
-- ============================================================

create table public.storefront_contact_settings (
  tienda_id         uuid        primary key references public.tiendas(id) on delete cascade,
  whatsapp_number  text        not null check (whatsapp_number ~ '^[1-9][0-9]{7,14}$'),
  whatsapp_display text        not null,
  instagram_url    text        not null check (instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$'),
  instagram_handle text        not null check (instagram_handle ~ '^[A-Za-z0-9._]+$'),
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.storefront_contact_settings is
  'Datos públicos de contacto usados por el catálogo web.';
comment on column public.storefront_contact_settings.whatsapp_number is
  'Número en formato internacional sin +, usado para wa.me.';
comment on column public.storefront_contact_settings.instagram_url is
  'URL pública del perfil de Instagram.';

create trigger storefront_contact_settings_updated_at
  before update on public.storefront_contact_settings
  for each row execute function public.update_updated_at();

alter table public.storefront_contact_settings enable row level security;

create policy "storefront_contact: anon puede leer activo"
  on public.storefront_contact_settings for select to anon
  using (is_active = true);

create policy "storefront_contact: usuarios leen su tienda"
  on public.storefront_contact_settings for select to authenticated
  using (tienda_id in (select public.get_user_tiendas()));

create policy "storefront_contact: admins insertan"
  on public.storefront_contact_settings for insert to authenticated
  with check (
    exists (
      select 1
      from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = storefront_contact_settings.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

create policy "storefront_contact: admins actualizan"
  on public.storefront_contact_settings for update to authenticated
  using (
    exists (
      select 1
      from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = storefront_contact_settings.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_tiendas ut
      where ut.user_id = (select auth.uid())
        and ut.tienda_id = storefront_contact_settings.tienda_id
        and ut.is_active = true
        and ut.rol = 'admin'
    )
  );

insert into public.storefront_contact_settings (
  tienda_id,
  whatsapp_number,
  whatsapp_display,
  instagram_url,
  instagram_handle
)
select
  t.id,
  '573012244006',
  '+57 301 224 4006',
  'https://www.instagram.com/moveongear/',
  'moveongear'
from public.tiendas t
where t.id = 'a1b2c3d4-0000-0000-0000-000000000001'
on conflict (tienda_id) do update set
  whatsapp_number = excluded.whatsapp_number,
  whatsapp_display = excluded.whatsapp_display,
  instagram_url = excluded.instagram_url,
  instagram_handle = excluded.instagram_handle,
  is_active = true;
