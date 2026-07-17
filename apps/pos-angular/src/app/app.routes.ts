import { Routes } from '@angular/router'
import { authGuard } from './core/auth/auth.guard'
import { roleGuard } from './core/auth/role.guard'
import { ShellComponent } from './core/layout/shell.component'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@angular-app/features/auth/presentation/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('@angular-app/features/auth/presentation/pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'restablecer-contrasena',
    loadComponent: () =>
      import('@angular-app/features/auth/presentation/pages/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pos' },
      {
        path: 'pos',
        loadComponent: () => import('@angular-app/features/pos/presentation/pages/pos.page').then((m) => m.PosPage),
      },
      {
        path: 'productos',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/products/presentation/pages/productos.page').then((m) => m.ProductosPage),
      },
      {
        path: 'productos/categorias',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/products/presentation/pages/categorias.page').then((m) => m.CategoriasPage),
      },
      {
        path: 'inventario',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/inventory/presentation/pages/inventario.page').then((m) => m.InventarioPage),
      },
      {
        path: 'caja',
        loadComponent: () =>
          import('@angular-app/features/cash-register/presentation/pages/caja.page').then((m) => m.CajaPage),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('@angular-app/features/customers/presentation/pages/clientes.page').then((m) => m.ClientesPage),
      },
      {
        path: 'reportes',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/reports/presentation/pages/reportes.page').then((m) => m.ReportesPage),
      },
      {
        path: 'finanzas',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/expenses/presentation/pages/finanzas.page').then((m) => m.FinanzasPage),
      },
      {
        path: 'auditoria',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/audit/presentation/pages/auditoria.page').then((m) => m.AuditoriaPage),
      },
      {
        path: 'configuracion',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@angular-app/features/settings/presentation/pages/configuracion.page').then((m) => m.ConfiguracionPage),
      },
    ],
  },
  { path: '**', redirectTo: 'pos' },
]
