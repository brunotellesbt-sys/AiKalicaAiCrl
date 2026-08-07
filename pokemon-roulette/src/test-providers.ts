import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideIcons } from '@ng-icons/core';

/**
 * Providers handed to every TestBed by the unit-test builder.
 *
 * Nearly every component in this game reads a translation, and most reach HttpClient
 * somewhere down their service graph. The generated specs never provided either — they
 * relied on `TranslateModule.forRoot()` being importable, which ngx-translate 18 removed.
 * Declaring them once here keeps all fifty-odd "should create" specs working without
 * repeating the same two lines in every file. The icon set is registered empty: the specs
 * only assert that components can be constructed, not what they render.
 */
export default [provideHttpClient(), provideTranslateService(), provideIcons({})];
