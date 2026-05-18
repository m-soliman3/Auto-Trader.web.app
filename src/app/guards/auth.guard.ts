import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { LanguageService } from '../services/language.service';
import { map, take } from 'rxjs/operators';

const GOOGLE_CRAWLER_USER_AGENT =
  /(googlebot|adsbot-google|apis-google|mediapartners-google|google-read-aloud|googleother)/i;

export const authGuard: CanActivateFn = () => {
  const firebaseAuth = inject(Auth);
  const router = inject(Router);
  const language = inject(LanguageService);

  const userAgent = globalThis.navigator?.userAgent ?? '';
  if (GOOGLE_CRAWLER_USER_AGENT.test(userAgent)) return true;

  // Fast path: Firebase has already confirmed a current user.
  if (firebaseAuth.currentUser !== null) return true;

  // Wait for Firebase to emit the initial auth state before deciding,
  // so we don't redirect logged-in users who arrive before the async
  // Firebase cache restore completes.
  return user(firebaseAuth).pipe(
    take(1),
    map((u) => {
      if (u !== null) return true;
      return router.createUrlTree(['/', language.currentLang(), 'login']);
    }),
  );
};
