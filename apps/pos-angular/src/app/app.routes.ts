import { Routes } from '@angular/router'
import { authGuard } from './core/auth/auth.guard'
import { ShellComponent } from './core/layout/shell.component'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
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
        loadComponent: () =>
          import('./features/products/productos.page').then((m) => m.ProductosPage),
      },
      {
        path: 'productos/categorias',
        loadComponent: () =>
          import('./features/products/categorias.page').then((m) => m.CategoriasPage),
      },
      {
        path: 'inventario',
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
        loadComponent: () =>
          import('./features/reports/reportes.page').then((m) => m.ReportesPage),
      },
    ],
  },
  { path: '**', redirectTo: 'pos' },
]
