import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Language } from '../../interfaces/language';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import {NgIcon} from '@ng-icons/core';

@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.css',
  imports: [
    NgbDropdownModule,
    NgIcon
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class LanguageSelectorComponent {
  private translateService = inject(TranslateService);

  languages: Language[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  ]

  currentLanguage: Language = this.languages[0];

  constructor() {
    // Both are signals in ngx-translate 18.
    const currentLanguage =
      this.translateService.currentLang() || this.translateService.fallbackLang() || 'en';
    this.updateCurrentLanguage(currentLanguage)
    this.translateService.onLangChange.subscribe(event => {
      this.updateCurrentLanguage(event.lang);
    });
  }

  changeLanguage(languageCode: string): void {
    if (!this.languages.some(lang => lang.code === languageCode)) return;

    this.translateService.use(languageCode);
    this.updateCurrentLanguage(languageCode);
    localStorage.setItem('language', languageCode);
  }

  private updateCurrentLanguage(languageCode: string): void {
    const language = this.languages.find(lang => lang.code === languageCode);
    if (language) {
      this.currentLanguage = language;
    }
  }
}
