import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const GOOGLE_CRAWLER_USER_AGENT =
  /(googlebot|adsbot-google|apis-google|mediapartners-google|google-read-aloud|googleother)/i;

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  const userAgent = globalThis.navigator?.userAgent ?? '';
  if (GOOGLE_CRAWLER_USER_AGENT.test(userAgent)) return true;
  return router.createUrlTree(['/login']);
};
