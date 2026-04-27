'use client'

import { useActionState } from 'react'
import {
  createClienteAction,
  updateClienteAction,
  type ClienteActionState,
} from '../application/actions/cliente.actions'
import { Dialog } from '@/shared/components/ui/Dialog'
import { Button } from '@/shared/components/ui/Button'
import { SubmitButton } from '@/shared/components/forms/SubmitButton'
import { useActionFeedback } from '@/shared/hooks/use-action-feedback'
import { cn } from '@/shared/lib/utils'
import type { Cliente } from '../domain/entities/cliente.entity'

interface Props {
  open: boolean
  onClose: () => void
  cliente?: Cliente | null
}

const INITIAL: ClienteActionState = { error: null }
const inputCls = cn(
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
)
const isDev = process.env.NODE_ENV === 'development'

export function ClienteFormDialog({ open, onClose, cliente }: Props) {
  const isEdit     = !!cliente
  const action     = isEdit ? updateClienteAction.bind(null, cliente.id) : createClienteAction
  const [state, formAction, pending] = useActionState(action, INITIAL)

  useActionFeedback({
    state,
    pending,
    onSuccess: onClose,
    successMessage: isEdit ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente',
    showErrorToast: true,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      isBusy={pending}
    >
      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Nombre <span className="text-destructive">*</span>
          </label>
          <input
            name="nombre"
            type="text"
            placeholder="Nombre completo"
            defaultValue={cliente?.nombre ?? (isDev ? 'Juan Pérez' : '')}
            required
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tipo doc.</label>
            <select
              name="tipoDocumento"
              defaultValue={cliente?.tipoDocumento ?? (isDev ? 'CC' : '')}
              className={cn(inputCls, 'cursor-pointer')}
            >
              <option value="">Sin tipo</option>
              <option value="CC">C.C.</option>
              <option value="NIT">NIT</option>
              <option value="CE">C.E.</option>
              <option value="PP">Pasaporte</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Número doc.</label>
            <input
              name="numeroDocumento"
              type="text"
              placeholder="1234567890"
              defaultValue={cliente?.numeroDocumento ?? (isDev ? '1000000001' : '')}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Teléfono</label>
          <input
            name="telefono"
            type="tel"
            placeholder="3001234567"
            defaultValue={cliente?.telefono ?? (isDev ? '3001234567' : '')}
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Correo electrónico</label>
          <input
            name="email"
            type="email"
            placeholder="cliente@email.com"
            defaultValue={cliente?.email ?? (isDev ? 'juan@email.com' : '')}
            className={inputCls}
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <SubmitButton isLoading={pending}>
            {isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
