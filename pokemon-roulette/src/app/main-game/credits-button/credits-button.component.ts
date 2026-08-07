import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-credits-button',
  imports: [
    NgIconsModule,
    TranslatePipe,
  ],
  templateUrl: './credits-button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credits-button.component.css'
})
export class CreditsButtonComponent {

  constructor(private router: Router,
              private gameStateService: GameStateService) {
    this.gameStateService.wheelSpinningObserver.subscribe(state => {
      this.wheelSpinning = state;
    });
  }

  wheelSpinning: boolean = false;

  goToCredits(): void {
    if (this.wheelSpinning) {
      return;
    }
    this.router.navigate(['credits']);
  }
}
