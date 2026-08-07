import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { GameMode, RunService, STARTING_LIVES } from '../../../../services/run-service/run.service';

interface ModeOption {
  mode: GameMode;
  titleKey: string;
  blurbKey: string;
  icon: string;
}

/**
 * Run mode picker, shown right after the region is chosen.
 *
 * Classic runs the game exactly as it always has. Type Advantage is additive: opponents
 * bring a real squad, typing tilts the battle wheel, and the run has lives.
 */
@Component({
  selector: 'app-mode-select',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './mode-select.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mode-select.component.css',
})
export class ModeSelectComponent {
  @Output() modeSelectedEvent = new EventEmitter<void>();

  readonly lives = STARTING_LIVES;

  readonly options: ModeOption[] = [
    {
      mode: 'classic',
      titleKey: 'game.main.roulette.mode.classic.title',
      blurbKey: 'game.main.roulette.mode.classic.blurb',
      icon: '🎯',
    },
    {
      mode: 'type-advantage',
      titleKey: 'game.main.roulette.mode.typeAdvantage.title',
      blurbKey: 'game.main.roulette.mode.typeAdvantage.blurb',
      icon: '⚔️',
    },
  ];

  constructor(private runService: RunService) {}

  select(mode: GameMode): void {
    this.runService.setMode(mode);
    this.runService.resetRun();
    this.modeSelectedEvent.emit();
  }
}
