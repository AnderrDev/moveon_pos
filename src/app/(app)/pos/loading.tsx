export default function PosLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 animate-pulse">
      {/* Panel izquierdo — búsqueda */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        <div className="h-10 w-full rounded-xl bg-muted" />
        <div className="flex-1 rounded-xl bg-muted/50" />
      </div>

      {/* Divider */}
      <div className="w-px bg-border" />

      {/* Panel derecho — carrito */}
      <div className="flex w-80 flex-col gap-4 p-4 lg:p-6 xl:w-96">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="flex-1 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="h-10 w-full rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}
