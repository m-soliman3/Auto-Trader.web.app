import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslateModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss'
})
export class Contact extends LocalizedLinks {
  senderEmail = '';
  subject     = '';
  message     = '';

  loading = signal(false);
  status  = signal<'idle' | 'success' | 'error'>('idle');
  errMsg  = signal('');

  private async postContactMessage(payload: { senderEmail: string; subject: string; message: string }) {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any)?.error || 'Failed to send message. Please try again.');
    }
  }

  async onSubmit() {
    if (!this.senderEmail || !this.subject || !this.message) return;

    this.loading.set(true);
    this.status.set('idle');
    this.errMsg.set('');

    try {
      const senderEmail = this.senderEmail.trim();
      const subject = this.subject.trim();
      const message = this.message.trim();

      await this.postContactMessage({ senderEmail, subject, message });

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
