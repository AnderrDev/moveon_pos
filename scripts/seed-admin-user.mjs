// Script temporal para crear el usuario admin via Supabase Auth Admin API
// Uso: node scripts/seed-admin-user.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rmaieqyscchtxxkgxgik.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYWllcXlzY2NodHh4a2d4Z2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE2MjE4OSwiZXhwIjoyMDkyNzM4MTg5fQ.XNieQPBJVka9HeYUnZ5MONpTrNylwaqmWAL74bikOuI'
const TIENDA_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // 1. Crear usuario via Admin API (hashea correctamente la contraseña)
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@moveonpos.co',
    password: 'Admin1234!',
    email_confirm: true,
    user_metadata: { nombre: 'Admin Test' },
    app_metadata: { provider: 'email', providers: ['email'] },
  })

  if (error) {
    console.error('Error creando usuario:', error.message)
    process.exit(1)
  }

  console.log('✅ Usuario creado:', data.user.id)

  // 2. Asignar a la tienda
  const { error: tiendaError } = await supabase
    .from('user_tiendas')
    .insert({
      user_id: data.user.id,
      tienda_id: TIENDA_ID,
      rol: 'admin',
      is_active: true,
    })

  if (tiendaError) {
    console.error('Error asignando tienda:', tiendaError.message)
    process.exit(1)
  }

  console.log('✅ Asignado a tienda:', TIENDA_ID)
  console.log('')
  console.log('Credenciales:')
  console.log('  Email:      admin@moveonpos.co')
  console.log('  Contraseña: Admin1234!')
}

main()
