#!/bin/sh
set -eu

SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo >&2 "[runtime-config] Debes definir SUPABASE_URL y SUPABASE_ANON_KEY."
  exit 1
fi

APP_ENV="${APP_ENV:-production}"
SENTRY_DSN="${SENTRY_DSN:-}"
APP_NAME="${APP_NAME:-MOVEONAPP POS}"
LANDING_APP_NAME="${LANDING_APP_NAME:-Move On Nutrition — Catálogo}"

write_runtime_config() {
  destination="$1"
  application_name="$2"

  jq -n \
    --arg supabaseUrl "$SUPABASE_URL" \
    --arg supabaseAnonKey "$SUPABASE_ANON_KEY" \
    --arg appName "$application_name" \
    --arg sentryDsn "$SENTRY_DSN" \
    --arg environment "$APP_ENV" \
    '{
      supabaseUrl: $supabaseUrl,
      supabaseAnonKey: $supabaseAnonKey,
      appName: $appName,
      sentryDsn: $sentryDsn,
      environment: $environment
    }' > "$destination"
}

write_runtime_config /usr/share/nginx/html/runtime-config.json "$APP_NAME"
write_runtime_config /usr/share/nginx/html/catalogo/runtime-config.json "$LANDING_APP_NAME"

echo "[runtime-config] Configuración generada para POS y landing."
