import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { SessionService } from './session.service'

export const authGuard: CanActivateFn = async () => {
  const sessionService = inject(SessionService)
  const router = inject(Router)
  const session = await sessionService.getSession()

  return session ? true : router.createUrlTree(['/login'])
}
