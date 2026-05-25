import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Observable, of } from 'rxjs';

/**
 * Translation loader for server-side rendering / prerendering.
 * Reads JSON files directly from the file system instead of making HTTP requests,
 * so translations are available synchronously during build-time prerendering.
 */
export class ServerTranslateLoader implements TranslateLoader {
  private readonly i18nDir: string;

  constructor(i18nDir?: string) {
    // During prerendering the process cwd is the project root; the browser
    // assets (including i18n JSON files) land in dist/auto-trading/browser/i18n/.
    this.i18nDir = i18nDir ?? join(process.cwd(), 'dist', 'auto-trading', 'browser', 'i18n');
  }

  getTranslation(lang: string): Observable<TranslationObject> {
    try {
      const filePath = join(this.i18nDir, `${lang}.json`);
      const raw = readFileSync(filePath, 'utf-8');
      return of(JSON.parse(raw) as TranslationObject);
    } catch {
      // Return empty translations if the file cannot be read (e.g., unsupported lang).
      return of({});
    }
  }
}
