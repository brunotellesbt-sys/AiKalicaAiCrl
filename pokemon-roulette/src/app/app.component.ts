import { Component, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CryService } from './services/cry-service/cry.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'pokemon-roulette';

  /** Keep in sync with LanguageSelectorComponent. */
  static readonly SUPPORTED_LANGS = ['en', 'pt-BR'];
  static readonly LANG_STORAGE_KEY = 'language';

  constructor(private translate: TranslateService, private cryService: CryService) {
    this.translate.addLangs(AppComponent.SUPPORTED_LANGS);

    // English stays the fallback so any key missing from another locale renders its English
    // text instead of a raw translation key. The fallback itself is declared in appConfig;
    // this keeps the two in step if that ever moves.
    this.translate.setFallbackLang('en');
    this.translate.use(this.resolveInitialLang());
  }

  private resolveInitialLang(): string {
    const saved = localStorage.getItem(AppComponent.LANG_STORAGE_KEY);
    if (saved && AppComponent.SUPPORTED_LANGS.includes(saved)) return saved;

    // First visit: follow the browser, but only into a locale we actually ship.
    const browser = (navigator.language || '').toLowerCase();
    if (browser.startsWith('pt')) return 'pt-BR';

    return 'en';
  }

  // Mobile browsers often block delayed audio unless the page has been "unlocked"
  // by a user gesture. This guarantees Mega cries can play after the 3s animation.
  @HostListener('window:pointerdown')
  async onFirstPointerDown() {
    await this.cryService.unlockAudio();
  }

  changeLang(lang: string) {
    if (!AppComponent.SUPPORTED_LANGS.includes(lang)) return;
    this.translate.use(lang);
    localStorage.setItem(AppComponent.LANG_STORAGE_KEY, lang);
  }
}
