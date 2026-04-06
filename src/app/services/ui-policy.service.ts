import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UiPolicyService {
  private readonly auth = inject(AuthService);

  readonly canChangeLanguage = computed(() => !this.auth.isLoggedIn());
}
