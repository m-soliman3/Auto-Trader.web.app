import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import emailjs from '@emailjs/browser';

// ── Fill these in after setting up EmailJS (see instructions below) ──
const EMAILJS_PUBLIC_KEY  = 'HYIL6fQcJSo0pHAhw';
const EMAILJS_SERVICE_ID  = 'Auto-Trader';
const EMAILJS_TEMPLATE_ID = 'template_z125ea9';

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

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_email: this.senderEmail,
          subject:    this.subject,
          message:    this.message,
          to_email:   'mohamed@investbegin.de',
        },
        EMAILJS_PUBLIC_KEY
      );
      this.status.set('success');
      this.senderEmail = '';
      this.subject     = '';
      this.message     = '';
    } catch (e: any) {
      this.errMsg.set(e?.text ?? 'Something went wrong. Please try again.');
      this.status.set('error');
    } finally {
      this.loading.set(false);
    }
  }
}
