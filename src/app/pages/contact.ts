import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// EmailJS public credentials — safe to include in browser code (read-only sending only).
const EMAILJS_SERVICE_ID  = 'Auto-Trader';
const EMAILJS_TEMPLATE_ID = 'template_z125ea9';
const EMAILJS_PUBLIC_KEY  = 'HYIL6fQcJSo0pHAhw';
const CONTACT_RECIPIENT   = 'mohamed@investbegin.de';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslateModule],
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

  private async postContactMessage(payload: { senderEmail: string; subject: string; message: string }) {
    const body = {
      service_id:   EMAILJS_SERVICE_ID,
      template_id:  EMAILJS_TEMPLATE_ID,
      user_id:      EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email:       CONTACT_RECIPIENT,
        recipient_email: CONTACT_RECIPIENT,
        to_name:        'Mohamed',
        from_email:     payload.senderEmail,
        sender_email:   payload.senderEmail,
        reply_to:       payload.senderEmail,
        subject:        payload.subject,
        message:        `From: ${payload.senderEmail.replace(/[\r\n]/g, '')}\n\n${payload.message}`,
      },
    };

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to send message. Please try again.');
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
