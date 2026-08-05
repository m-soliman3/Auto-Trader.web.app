import { Injectable, computed, inject } from '@angular/core';
import { AuthService, User } from './auth.service';

type LimitedResource = 'exchange' | 'bot' | 'strategy';

const FREE_LIMITS: Record<LimitedResource, number> = {
  exchange: 1,
  bot: 1,
  strategy: 1,
};

const PREMIUM_LIMITS: Record<LimitedResource, number> = {
  exchange: 10,
  bot: 25,
  strategy: 25,
};

const PREMIUM_MONTHLY_PRICE_USD = 10;

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private auth = inject(AuthService);

  isPremium = computed(() => this.resolvePremiumState(this.auth.currentUser()));

  canCreate(resource: LimitedResource, existingCount: number): boolean {
    return existingCount < this.getLimit(resource);
  }

  assertCanCreate(resource: LimitedResource, existingCount: number) {
    if (this.canCreate(resource, existingCount)) return;
    throw new Error(this.buildLimitMessage(resource));
  }

  private buildLimitMessage(resource: LimitedResource): string {
    const label = resource === 'exchange'
      ? 'exchange connection'
      : resource === 'bot'
        ? 'bot'
        : 'strategy';

    if (!this.isPremium()) {
      return `Free plan limit reached: you can connect only ${FREE_LIMITS[resource]} ${label}. Upgrade to Premium for $${PREMIUM_MONTHLY_PRICE_USD}/month to add more.`;
    }

    return `Premium plan limit reached: you can connect up to ${PREMIUM_LIMITS[resource]} ${label}${PREMIUM_LIMITS[resource] > 1 ? 's' : ''}.`;
  }

  private getLimit(resource: LimitedResource): number {
    return this.isPremium() ? PREMIUM_LIMITS[resource] : FREE_LIMITS[resource];
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