interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

/**
 * Cabecera estándar de página — título + descripción + acciones opcionales.
 * Uso: <PageHeader title="Productos" description="..."><Button>Agregar</Button></PageHeader>
 */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="mt-3 flex flex-shrink-0 items-center gap-2 sm:mt-0">
          {children}
        </div>
      )}
    </div>
  )
}
