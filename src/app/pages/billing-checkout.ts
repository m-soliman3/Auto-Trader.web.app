import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { loadStripe, Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string | null;
  subscriptionId: string;
  amount: number;
  currency: string;
  paymentRequired?: boolean;
  subscriptionStatus?: string;
}

interface ConfirmPremiumActivationResponse {
  ok: boolean;
  message: string;
}

@Component({
  selector: 'app-billing-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './billing-checkout.html',
  styleUrl: './billing-checkout.scss',
})
export class BillingCheckoutPage implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cardholderName = signal('');
  billingEmail = signal(this.auth.currentUser?.email ?? '');
  statusMessage = signal('');
  errorMessage = signal('');
  isInitializing = signal(false);
  isProcessing = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.initializeStripe();
  }

  ngOnDestroy(): void {
    this.cardElement?.destroy();
  }

  async payAndActivatePremium(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');

    if (!this.stripe || !this.cardElement) {
      this.errorMessage.set('Payment form is not ready yet. Please try again in a moment.');
      return;
    }

    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      this.errorMessage.set('Please log in again to continue with payment.');
      return;
    }

    this.isProcessing.set(true);

    try {
      const idToken = await firebaseUser.getIdToken();
      const createResp = await this.createPaymentIntent(idToken);

      const paymentRequired = createResp.paymentRequired !== false;
      if (paymentRequired) {
        this.statusMessage.set('Processing payment...');

        const result = await this.stripe.confirmCardPayment(createResp.clientSecret, {
          payment_method: {
            card: this.cardElement,
            billing_details: {
              name: this.cardholderName().trim() || undefined,
              email: this.billingEmail().trim() || firebaseUser.email || undefined,
            },
          },
        });

        if (result.error) {
          this.errorMessage.set(result.error.message || 'Payment failed. Please check your card details and try again.');
          this.isProcessing.set(false);
          return;
        }

        const paymentIntentId = result.paymentIntent?.id || createResp.paymentIntentId;
        if (!paymentIntentId || !createResp.subscriptionId) {
          this.errorMessage.set('Payment completed, but subscription activation could not be verified. Please contact support.');
          this.isProcessing.set(false);
          return;
        }
      }

      this.statusMessage.set('Activating Premium subscription...');
      await this.confirmPremiumActivation(idToken, createResp.subscriptionId);
      await this.authService.reloadCurrentUserProfile();

      this.statusMessage.set('Premium subscription activated. Redirecting to billing management...');
      setTimeout(() => {
        void this.router.navigate(['/billing', 'manage']);
      }, 1200);
    } catch (error: any) {
      const apiError = error?.error?.error;
      this.errorMessage.set(apiError || error?.message || 'Unable to process payment right now. Please try again later.');
      this.isProcessing.set(false);
      return;
    }

    this.isProcessing.set(false);
  }

  private async initializeStripe(): Promise<void> {
    this.isInitializing.set(true);
    this.errorMessage.set('');

    const key = (environment.stripePublishableKey || '').trim();
    if (!key) {
      this.errorMessage.set('Stripe is not configured. Add environment.stripePublishableKey to enable checkout.');
      this.isInitializing.set(false);
      return;
    }

    this.stripe = await loadStripe(key);
    if (!this.stripe) {
      this.errorMessage.set('Unable to initialize secure payment form. Please refresh and try again.');
      this.isInitializing.set(false);
      return;
    }

    this.elements = this.stripe.elements({
      appearance: {
        theme: 'stripe',
        labels: 'floating',
      },
    });

    this.cardElement = this.elements.create('card', {
      hidePostalCode: false,
    });

    this.cardElement.mount('#card-element');
    this.cardElement.on('change', (event) => {
      if (event.error?.message) {
        this.errorMessage.set(event.error.message);
      } else if (!this.isProcessing()) {
        this.errorMessage.set('');
      }
    });

    this.isInitializing.set(false);
  }

  private async createPaymentIntent(idToken: string): Promise<CreatePaymentIntentResponse> {
    const response = await firstValueFrom(
      this.http.post<CreatePaymentIntentResponse>(
        '/api/createPremiumSubscriptionIntent',
        {},
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          }),
        },
      ),
    );

    return response;
  }

  private async confirmPremiumActivation(idToken: string, subscriptionId: string): Promise<ConfirmPremiumActivationResponse> {
    const response = await firstValueFrom(
      this.http.post<ConfirmPremiumActivationResponse>(
        '/api/confirmPremiumSubscriptionActivation',
        { subscriptionId },
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          }),
        },
      ),
    );

    return response;
  }
}
