'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { CategoriaFormDialog } from './CategoriaFormDialog'

export function AddCategoriaButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nueva categoría
      </Button>

      <CategoriaFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
