import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { SupabaseClienteRepository } from '@/modules/customers/infrastructure/repositories/supabase-cliente.repository'
import { ClientesTable } from '@/modules/customers/components/ClientesTable'
import { PageHeader } from '@/shared/components/layout/PageHeader'

export default async function ClientesPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const repo   = new SupabaseClienteRepository()
  const result = await repo.list(auth.tiendaId)
  const clientes = result.ok ? result.value : []

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrado${clientes.length !== 1 ? 's' : ''}`}
      />
      <ClientesTable clientes={clientes} />
    </>
  )
}
