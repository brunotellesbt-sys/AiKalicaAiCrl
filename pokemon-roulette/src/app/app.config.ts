import { ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { routes } from './app.routes';
import { HttpClient, provideHttpClient, withXhr } from '@angular/common/http';
import {
  bootstrapArrowRepeat,
  bootstrapCheck,
  bootstrapClock,
  bootstrapController,
  bootstrapCupHotFill,
  bootstrapGear,
  bootstrapMap,
  bootstrapPcDisplayHorizontal,
  bootstrapPeopleFill,
  bootstrapShare,
} from '@ng-icons/bootstrap-icons';

import {
  MissingTranslationHandler,
  provideMissingTranslationHandler,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { PrettyMissingTranslationHandler } from './shared/pretty-missing-translation.handler';

// IMPORTANT (GitHub Pages compatibility):
// - Hash-based routing prevents 404s on deep links on static hosting.
// - Translation paths must be *relative* (no leading slash) so it works under /<repo>/.

export function httpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, 'i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideIcons({
      bootstrapArrowRepeat,
      bootstrapCheck,
      bootstrapClock,
      bootstrapController,
      bootstrapCupHotFill,
      bootstrapGear,
      bootstrapPcDisplayHorizontal,
      bootstrapPeopleFill,
      bootstrapShare,
      bootstrapMap,
    }),
    provideHttpClient(withXhr()),
    provideZoneChangeDetection({ eventCoalescing: true }),

    // ngx-translate 18 dropped TranslateModule for providers, and renamed the
    // "default language" to the fallback language. Declaring it here replaces the old
    // useDefaultLang flag: a key missing from pt-BR still renders its English text
    // instead of showing the raw key.
    provideTranslateService({
      fallbackLang: 'en',
      loader: provideTranslateLoader(() => httpLoaderFactory(inject(HttpClient))),
      missingTranslationHandler: provideMissingTranslationHandler(
        PrettyMissingTranslationHandler
      ),
    }),
  ],
};
