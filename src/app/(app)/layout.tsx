/**
 * Layout principal de la app con sidebar.
 * Sprint 1: agregar verificación de sesión + redirección a /login si no autenticado.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — implementar en Sprint 1 */}
      <aside className="w-64 bg-card border-r flex-shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-lg">MOVEONAPP POS</span>
        </div>
        {/* Nav items — Sprint 1 */}
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
