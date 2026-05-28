#!/usr/bin/env bash
# Crea (idempotente) un usuario cajero de prueba en Supabase staging y lo
# enlaza a la tienda con rol 'cajero'. Uso de service role -> ejecutar local.
#   bash scripts/create-cajero-test-user.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SR_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)
SB_URL="https://rmaieqyscchtxxkgxgik.supabase.co"
TIENDA_ID="a1b2c3d4-0000-0000-0000-000000000001"
EMAIL="cajero@moveonpos.co"
PASSWORD="Cajero1234!"

echo "==> Creando usuario auth (si no existe) via Admin API"
curl -s -X POST "$SB_URL/auth/v1/admin/users" \
  -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" \
  | head -c 300
echo ""

echo "==> Resolviendo el user_id desde la DB (por email)"
USER_ID=$(psql "$DB_URL" -tA -c "select id from auth.users where email='$EMAIL';")
if [ -z "$USER_ID" ]; then
  echo "ERROR: no se encontró el usuario $EMAIL en auth.users (revisa la respuesta de la API arriba)."
  exit 1
fi
echo "user_id=$USER_ID"

echo "==> Enlazando a user_tiendas como cajero (idempotente)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "insert into user_tiendas (id, user_id, tienda_id, rol, is_active, created_at)
  select gen_random_uuid(), '$USER_ID', '$TIENDA_ID', 'cajero', true, now()
  where not exists (select 1 from user_tiendas where user_id = '$USER_ID');"

echo "==> Verificación"
psql "$DB_URL" -P pager=off -c "select u.email, ut.rol, ut.is_active
  from user_tiendas ut join auth.users u on u.id = ut.user_id order by ut.rol;"
echo "==> Listo. Cajero: $EMAIL / $PASSWORD"
