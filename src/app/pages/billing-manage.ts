import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

interface BillingInvoice {
  id: string;
  amountPaid: number;
  currency: string;
  status: string;
  createdAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface BillingOverviewResponse {
  plan: string;
  hasSubscription: boolean;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  subscriptionId: string | null;
  invoices: BillingInvoice[];
}

@Component({
  selector: 'app-billing-manage',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './billing-manage.html',
  styleUrl: './billing-manage.scss',
})
export class BillingManagePage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  cancelLoading = signal(false);
  statusMessage = signal('');
  errorMessage = signal('');
  overview = signal<BillingOverviewResponse | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadBillingOverview();
  }

  async loadBillingOverview(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');

    try {
      const idToken = await this.requireIdToken();
      const response = await firstValueFrom(
        this.http.get<BillingOverviewResponse>('/api/getPremiumBillingOverview', {
          headers: new HttpHeaders({
            Authorization: `Bearer ${idToken}`,
          }),
        }),
      );

      this.overview.set(response);
    } catch (error: any) {
      this.errorMessage.set(error?.message || 'Unable to load billing information right now.');
    }

    this.loading.set(false);
  }

  async cancelAtPeriodEnd(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.cancelLoading.set(true);

    try {
      const idToken = await this.requireIdToken();
      const response = await firstValueFrom(
        this.http.post<{ ok: boolean; message: string; currentPeriodEnd?: string | null }>(
          '/api/cancelPremiumSubscription',
          {},
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      this.statusMessage.set(response.message || 'Subscription cancellation requested.');
      await this.authService.reloadCurrentUserProfile();
      await this.loadBillingOverview();
    } catch (error: any) {
      this.errorMessage.set(error?.message || 'Unable to cancel subscription right now.');
    }

    this.cancelLoading.set(false);
  }

  formatMoney(cents: number, currency: string): string {
    const normalizedCurrency = (currency || 'usd').toUpperCase();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((cents || 0) / 100);
  }

  formatDate(value: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  canCancel(): boolean {
    const data = this.overview();
    if (!data) return false;
    if (!data.hasSubscription) return false;
    if (data.cancelAtPeriodEnd) return false;
    return data.status === 'active' || data.status === 'trialing';
  }

  private async requireIdToken(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Please log in again to manage billing.');
    }

    return user.getIdToken();
  }
}
