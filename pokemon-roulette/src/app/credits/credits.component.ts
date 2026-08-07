
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainGameButtonComponent } from '../main-game-button/main-game-button.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-credits',
  imports: [MainGameButtonComponent, TranslatePipe],
  templateUrl: './credits.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credits.component.css',
})
export class CreditsComponent {}
