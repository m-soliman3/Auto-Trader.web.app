import { APP_INITIALIZER, ApplicationConfig, inject, mergeApplicationConfig } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { provideServerRendering } from '@angular/platform-server';
import { TranslateLoader, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { appConfig } from './app.config';
import { ServerTranslateLoader } from './translate/server-translate.loader';
import { LANGUAGES } from './services/language.service';

const LANG_CODES = LANGUAGES.map((l) => l.code);

/**
 * Returns the language code found in a URL path (e.g. "/ar/learn/foo" → "ar").
 * Falls back to "en" if none is found.
 */
function detectLangFromPath(pathname: string): string {
  const seg = pathname.split('/').find((s) => LANG_CODES.includes(s));
  return seg ?? 'en';
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),

    // Override the HTTP-based translate loader with a synchronous file-system loader
    // so translations are available immediately during prerendering.
    { provide: TranslateLoader, useFactory: () => new ServerTranslateLoader() },

    // Pre-load the translations for the language being prerendered so that
    // translate.instant() returns correct strings when components render.
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const translate = inject(TranslateService);
        const doc = inject(DOCUMENT);
        return async () => {
          const lang = detectLangFromPath((doc as Document & { location: Location }).location?.pathname ?? '/en');
          await firstValueFrom(translate.use(lang));
        };
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
