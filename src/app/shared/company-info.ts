/**
 * Single source of truth for legal / company identity used across the site.
 *
 * All legal pages (Privacy Policy, Terms, Disclaimer, Contact, footer) should
 * reference these constants so that a future update only requires changing
 * this file.
 *
 * NOTE: The i18n JSON files (public/i18n/*.json) still contain hard-coded
 * translated strings because ngx-translate does not support interpolation
 * from TS constants at build time.  When updating company details, update
 * BOTH this file AND the i18n JSONs (search for the old value).
 */
export const COMPANY_INFO = {
  /** Legal entity name (used in privacy policy, terms, disclaimer, footer copyright). */
  legalName: 'Planck Software',

  /** Primary contact email shown on all legal / support pages. */
  contactEmail: 'founder@invest-begin.com',

  /** Registered address (matches the /contact page). */
  address: 'Kapstadt Ring 7a, 22297 Hamburg, Germany',

  /** Public-facing website URL. */
  website: 'https://auto-trading.app',
} as const;
