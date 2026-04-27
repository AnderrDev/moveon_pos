import { LoginForm } from '@/modules/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Encabezado — solo visible en móvil (en desktop lo muestra el panel lateral) */}
      <div className="lg:hidden text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-extrabold text-white text-xl">
          M
        </div>
        <h1 className="text-2xl font-bold">MOVEONAPP POS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Punto de Venta</p>
      </div>

      {/* Card del formulario */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          ¿Problemas para ingresar? Contacta a tu administrador.
        </p>
      </div>
    </div>
  )
}
