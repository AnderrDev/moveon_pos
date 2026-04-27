export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[540px] flex-shrink-0 flex-col justify-between p-12 relative overflow-hidden bg-sidebar">
        {/* Decorative geometry */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full bg-primary opacity-[0.12]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -right-10 h-48 w-48 -translate-y-1/2 rounded-full bg-primary opacity-[0.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-12 h-72 w-72 rounded-full bg-primary opacity-[0.07]"
        />
        {/* Dot grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(220 20% 40% / 0.25) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5 text-white"
              aria-hidden
            >
              <path
                d="M3 10h2m10 0h2M5 10a5 5 0 0110 0M5 10a5 5 0 0010 0M8 10v-1m4 0v1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-white text-[15px] leading-none tracking-wide">
              MOVEONAPP
            </p>
            <p className="mt-0.5 text-[11px] text-sidebar-muted font-medium">Punto de Venta</p>
          </div>
        </div>

        {/* Central content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="font-display text-3xl font-bold text-white leading-snug">
              Tu tienda,<br />bajo control total
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-sidebar-fg max-w-sm">
              Gestiona ventas, inventario y caja desde un solo lugar. Diseñado para tiendas de suplementos en Colombia.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-2.5">
            {[
              'Ventas rápidas con búsqueda de productos',
              'Control de inventario en tiempo real',
              'Cierre de caja y reportes del día',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm text-sidebar-fg">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-[11px] text-sidebar-muted">
          © {new Date().getFullYear()} MOVEONAPP POS · Todos los derechos reservados.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        {children}
      </div>
    </div>
  )
}
