-- =====================================================
-- Auditoría completa (2026-10-24): completar registros históricos
-- =====================================================
-- Rellena SOLO campos vacíos de registros existentes: el correo del usuario
-- (desde auth.users) y el nombre de la entidad (audit_entity_label). No
-- cambia acciones, fechas, usuarios ni el detalle (changes/metadata).
-- El nombre es el ACTUAL de la entidad (si un producto se renombró, se ve
-- el nombre de hoy). Idempotente. Cambio de DATOS: en producción requiere
-- OK explícito del dueño.
-- =====================================================

update public.audit_logs a
set user_email = u.email
from auth.users u
where u.id = a.user_id
  and coalesce(a.user_email, '') = ''
  and u.email is not null;

update public.audit_logs a
set entity_label = l.label
from (
  select id, public.audit_entity_label(entity_type, entity_id) as label
  from public.audit_logs
  where entity_label is null
     or entity_label ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) l
where l.id = a.id
  and l.label is not null;
