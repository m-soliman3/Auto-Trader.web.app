import { Injectable, computed, inject } from '@angular/core';
import { AuthService, User } from './auth.service';

type LimitedResource = 'exchange' | 'bot' | 'strategy';

const FREE_LIMIT_PER_RESOURCE = 1;
const PREMIUM_MONTHLY_PRICE_USD = 10;

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private auth = inject(AuthService);

  isPremium = computed(() => this.resolvePremiumState(this.auth.currentUser()));

  canCreate(resource: LimitedResource, existingCount: number): boolean {
    if (this.isPremium()) return true;
    return existingCount < FREE_LIMIT_PER_RESOURCE;
  }

  assertCanCreate(resource: LimitedResource, existingCount: number) {
    if (this.canCreate(resource, existingCount)) return;
    throw new Error(this.buildUpgradeMessage(resource));
  }

  private buildUpgradeMessage(resource: LimitedResource): string {
    const label = resource === 'exchange'
      ? 'exchange connection'
      : resource === 'bot'
        ? 'bot'
        : 'strategy';

    return `Free plan limit reached: you can connect only 1 ${label}. Upgrade to Premium for $${PREMIUM_MONTHLY_PRICE_USD}/month to add more.`;
  }

  private resolvePremiumState(user: User | null): boolean {
    if (!user) return false;

    const normalizedPlan = String(user.plan ?? '').trim().toLowerCase();
    if (normalizedPlan === 'premium' || normalizedPlan === 'pro') {
      return true;
    }

    const subscription = user.subscription;
    if (!subscription) return false;

    if (subscription.active === true) return true;

    const normalizedStatus = String(subscription.status ?? '').trim().toLowerCase();
    return normalizedStatus === 'active' || normalizedStatus === 'trialing';
  }
}