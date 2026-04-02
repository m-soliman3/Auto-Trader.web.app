import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

const CONTACT_API_URL =
  globalThis.location?.hostname === 'localhost'
    ? 'https://europe-west1-autotrader-b8851.cloudfunctions.net/sendContactMessage'
    : '/api/contact';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss'
})
export class Contact {
  senderEmail = '';
  subject     = '';
  message     = '';

  loading = signal(false);
  status  = signal<'idle' | 'success' | 'error'>('idle');
  errMsg  = signal('');

  async onSubmit() {
    if (!this.senderEmail || !this.subject || !this.message) return;

    this.loading.set(true);
    this.status.set('idle');
    this.errMsg.set('');

    try {
      const senderEmail = this.senderEmail.trim();
      const subject = this.subject.trim();
      const message = this.message.trim();

      const response = await fetch(CONTACT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderEmail, subject, message }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Something went wrong. Please try again.');
      }

      this.status.set('success');
      this.senderEmail = '';
      this.subject     = '';
      this.message     = '';
    } catch (e: any) {
      this.errMsg.set(e?.message ?? 'Something went wrong. Please try again.');
      this.status.set('error');
    } finally {
      this.loading.set(false);
    }
  }
}
