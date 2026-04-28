import { redirect } from 'next/navigation'
import { getAuthContext } from '@/shared/lib/auth-context'
import { Sidebar } from '@/shared/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Ir al contenido principal
      </a>
      <Sidebar userEmail={auth.email ?? undefined} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main id="main-content" className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
