import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from './app.config';

/**
 * Reads translation files directly from disk during prerendering.
 * This avoids HTTP requests that would fail in a Node.js build context.
 */
class ServerTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    try {
      const filePath = join(process.cwd(), 'public', 'i18n', `${lang}.json`);
      return of(JSON.parse(readFileSync(filePath, 'utf-8')) as TranslationObject);
    } catch {
      return of({});
    }
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    { provide: TranslateLoader, useClass: ServerTranslateLoader },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
