import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import {
  CanMakePaymentResult,
  loadStripe,
  PaymentRequest,
  Stripe,
  StripeCardElement,
  StripeElements,
  StripePaymentRequestButtonElement,
} from '@stripe/stripe-js';
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

interface CreatePayPalSubscriptionResponse {
  subscriptionId: string;
  approvalUrl: string;
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
  private readonly route = inject(ActivatedRoute);

  cardholderName = signal('');
  billingEmail = signal(this.auth.currentUser?.email ?? '');
  statusMessage = signal('');
  errorMessage = signal('');
  isInitializing = signal(false);
  isProcessing = signal(false);
  walletReady = signal(false);
  walletLabel = signal('');
  walletError = signal('');
  paypalLoading = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private paymentRequest: PaymentRequest | null = null;
  private paymentRequestButton: StripePaymentRequestButtonElement | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.initializeStripe();
    await this.tryHandlePayPalReturn();
  }

  ngOnDestroy(): void {
    this.cardElement?.destroy();
    this.paymentRequestButton?.destroy();
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

  async startPayPalSubscription(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');

    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      this.errorMessage.set('Please log in again to continue with payment.');
      return;
    }

    this.paypalLoading.set(true);

    try {
      const idToken = await firebaseUser.getIdToken();
      const base = window.location.origin;
      const response = await firstValueFrom(
        this.http.post<CreatePayPalSubscriptionResponse>(
          '/api/createPayPalSubscription',
          {
            returnUrl: `${base}/billing/checkout?paypal=success`,
            cancelUrl: `${base}/billing/checkout?paypal=cancel`,
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      if (!response?.approvalUrl) {
        this.errorMessage.set('Unable to start PayPal checkout. Please try again.');
        this.paypalLoading.set(false);
        return;
      }

      window.location.assign(response.approvalUrl);
    } catch (error: any) {
      const apiError = error?.error?.error;
      this.errorMessage.set(apiError || error?.message || 'Unable to start PayPal checkout right now.');
      this.paypalLoading.set(false);
    }
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

    await this.initializeWalletCheckout();

    this.isInitializing.set(false);
  }

  private async initializeWalletCheckout(): Promise<void> {
    if (!this.stripe) {
      return;
    }

    this.paymentRequest = this.stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: 'AutoTrader Premium (monthly)',
        amount: 1000,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    const canMakePayment = await this.paymentRequest.canMakePayment();
    this.setWalletLabel(canMakePayment);
    if (!canMakePayment) {
      this.walletReady.set(false);
      return;
    }

    const walletElements = this.stripe.elements();
    this.paymentRequestButton = walletElements.create('paymentRequestButton', {
      paymentRequest: this.paymentRequest,
    });
    this.paymentRequestButton.mount('#wallet-button');
    this.walletReady.set(true);

    this.paymentRequest.on('paymentmethod', async (event) => {
      this.errorMessage.set('');
      this.walletError.set('');
      this.statusMessage.set('Processing wallet payment...');

      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser || !this.stripe) {
        event.complete('fail');
        this.walletError.set('Please log in again to continue.');
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const createResp = await this.createPaymentIntent(idToken);

        if (!createResp.subscriptionId) {
          event.complete('fail');
          this.walletError.set('Unable to prepare subscription payment.');
          return;
        }

        const paymentRequired = createResp.paymentRequired !== false;
        if (paymentRequired) {
          let confirmResult = await this.stripe.confirmCardPayment(
            createResp.clientSecret,
            {
              payment_method: event.paymentMethod.id,
            },
            {
              handleActions: false,
            },
          );

          if (confirmResult.error) {
            event.complete('fail');
            this.walletError.set(confirmResult.error.message || 'Wallet payment failed.');
            return;
          }

          if (confirmResult.paymentIntent?.status === 'requires_action') {
            confirmResult = await this.stripe.confirmCardPayment(createResp.clientSecret);
            if (confirmResult.error) {
              event.complete('fail');
              this.walletError.set(confirmResult.error.message || 'Wallet payment authentication failed.');
              return;
            }
          }
        }

        await this.confirmPremiumActivation(idToken, createResp.subscriptionId);
        await this.authService.reloadCurrentUserProfile();

        event.complete('success');
        this.statusMessage.set('Premium subscription activated. Redirecting to billing management...');
        setTimeout(() => {
          void this.router.navigate(['/billing', 'manage']);
        }, 1000);
      } catch (error: any) {
        event.complete('fail');
        const apiError = error?.error?.error;
        this.walletError.set(apiError || error?.message || 'Wallet payment failed. Please try card or PayPal.');
      }
    });
  }

  private setWalletLabel(details: CanMakePaymentResult | null): void {
    if (!details) {
      this.walletLabel.set('Apple Pay / Google Pay not available on this device.');
      return;
    }

    if (details['applePay']) {
      this.walletLabel.set('Pay quickly with Apple Pay.');
      return;
    }

    if (details['googlePay']) {
      this.walletLabel.set('Pay quickly with Google Pay.');
      return;
    }

    this.walletLabel.set('Express wallet checkout is available.');
  }

  private async tryHandlePayPalReturn(): Promise<void> {
    const paypalState = String(this.route.snapshot.queryParamMap.get('paypal') || '').toLowerCase();
    const paypalSubscriptionId = String(this.route.snapshot.queryParamMap.get('subscription_id') || '').trim();

    if (paypalState === 'cancel') {
      this.errorMessage.set('PayPal checkout was cancelled.');
      return;
    }

    if (paypalState !== 'success' || !paypalSubscriptionId) {
      return;
    }

    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      this.errorMessage.set('Please log in again to finish PayPal activation.');
      return;
    }

    this.statusMessage.set('Confirming PayPal subscription...');
    this.isProcessing.set(true);

    try {
      const idToken = await firebaseUser.getIdToken();
      await this.confirmPayPalSubscription(idToken, paypalSubscriptionId);
      await this.authService.reloadCurrentUserProfile();
      this.statusMessage.set('Premium subscription activated via PayPal. Redirecting to billing management...');
      setTimeout(() => {
        void this.router.navigate(['/billing', 'manage']);
      }, 1000);
    } catch (error: any) {
      const apiError = error?.error?.error;
      this.errorMessage.set(apiError || error?.message || 'Unable to confirm PayPal subscription.');
    }

    this.isProcessing.set(false);
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

  private async confirmPayPalSubscription(idToken: string, subscriptionId: string): Promise<ConfirmPremiumActivationResponse> {
    const response = await firstValueFrom(
      this.http.post<ConfirmPremiumActivationResponse>(
        '/api/confirmPayPalSubscription',
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
