'use client'

import { useState, useTransition } from 'react'
import { ClienteFormDialog } from './ClienteFormDialog'
import { deleteClienteAction } from '../application/actions/cliente.actions'
import { Button } from '@/shared/components/ui/Button'
import { useToast } from '@/shared/components/feedback/ToastProvider'
import type { Cliente } from '../domain/entities/cliente.entity'

interface Props { clientes: Cliente[] }

export function ClientesTable({ clientes }: Props) {
  const [addOpen, setAddOpen]         = useState(false)
  const [editTarget, setEditTarget]   = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const toast = useToast()

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteClienteAction(deleteTarget.id)
      if (result.error) { setDeleteError(result.error); toast.error(result.error); return }
      setDeleteTarget(null)
      toast.success(result.message ?? 'Cliente eliminado')
    })
  }

  if (clientes.length === 0 && !addOpen) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" aria-hidden>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm font-semibold">Sin clientes aún</p>
          <p className="mt-1 text-sm text-muted-foreground">Registra tu primer cliente.</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>+ Nuevo cliente</Button>
        </div>
        <ClienteFormDialog open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ Nuevo cliente</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teléfono</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correo</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-4 font-medium">{c.nombre}</td>
                <td className="px-5 py-4 text-muted-foreground">
                  {c.tipoDocumento && c.numeroDocumento
                    ? `${c.tipoDocumento} ${c.numeroDocumento}`
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-5 py-4 text-muted-foreground">{c.telefono ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className="px-5 py-4 text-muted-foreground">{c.email ?? <span className="text-muted-foreground/50">—</span>}</td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(c)}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(c); setDeleteError(null) }}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!isPending) setDeleteTarget(null) }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border/60">
            <h3 className="font-display text-lg font-bold">Eliminar cliente</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar a <strong>{deleteTarget.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && <p className="mt-2 text-sm text-destructive">{deleteError}</p>}
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={isPending}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" isLoading={isPending} loadingText="Eliminando…" onClick={handleDelete}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ClienteFormDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <ClienteFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} cliente={editTarget} />
    </div>
  )
}
