import { Routes } from '@angular/router'
import { authGuard } from './core/auth/auth.guard'
import { roleGuard } from './core/auth/role.guard'
import { ShellComponent } from './core/layout/shell.component'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'restablecer-contrasena',
    loadComponent: () =>
      import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pos' },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos.page').then((m) => m.PosPage),
      },
      {
        path: 'productos',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/products/productos.page').then((m) => m.ProductosPage),
      },
      {
        path: 'productos/categorias',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/products/categorias.page').then((m) => m.CategoriasPage),
      },
      {
        path: 'inventario',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/inventory/inventario.page').then((m) => m.InventarioPage),
      },
      {
        path: 'caja',
        loadComponent: () =>
          import('./features/cash-register/caja.page').then((m) => m.CajaPage),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/customers/clientes.page').then((m) => m.ClientesPage),
      },
      {
        path: 'reportes',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/reports/reportes.page').then((m) => m.ReportesPage),
      },
      {
        path: 'finanzas',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/expenses/finanzas.page').then((m) => m.FinanzasPage),
      },
      {
        path: 'auditoria',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/audit/auditoria.page').then((m) => m.AuditoriaPage),
      },
      {
        path: 'configuracion',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/settings/configuracion.page').then((m) => m.ConfiguracionPage),
      },
    ],
  },
  { path: '**', redirectTo: 'pos' },
]
