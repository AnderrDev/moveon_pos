interface ComingSoonProps {
  sprint: string
  features: string[]
  icon: React.ReactNode
}

export function ComingSoon({ sprint, features, icon }: ComingSoonProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary opacity-[0.04]" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-primary opacity-[0.03]" />

      <div className="relative px-8 py-12">
        {/* Icon + sprint badge */}
        <div className="flex flex-wrap items-center gap-4 mb-7">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary tracking-wide">
            {sprint}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-xl font-bold text-foreground">En construcción</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
          Esta sección estará disponible pronto. Aquí van las funcionalidades planificadas:
        </p>

        {/* Features grid */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {features.map((feature, i) => (
            <div
              key={feature}
              className="flex items-start gap-3.5 rounded-xl border bg-background/70 px-4 py-3.5"
            >
              <span className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold tabular-nums text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm leading-snug text-foreground/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
