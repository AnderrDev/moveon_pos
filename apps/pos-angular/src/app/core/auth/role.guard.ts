import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import type { Role } from '@/shared/types'
import { SessionService } from './session.service'
import { canActivateForRole } from './role-policy'

/**
 * Guard factory: restringe una ruta a los roles `allowed`.
 * Resuelve el rol vía SessionService y delega la decisión en la función pura
 * `canActivateForRole`. No autenticado lo cubre `authGuard`; aquí, si el rol no
 * está autorizado, redirige a `/pos`.
 */
export function roleGuard(...allowed: readonly Role[]): CanActivateFn {
  return async () => {
    const sessionService = inject(SessionService)
    const router = inject(Router)
    const rol = await sessionService.getRole()

    return canActivateForRole(rol, allowed) ? true : router.createUrlTree(['/pos'])
  }
}
