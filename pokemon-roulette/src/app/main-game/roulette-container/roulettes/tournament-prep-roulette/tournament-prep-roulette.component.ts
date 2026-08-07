import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';

/**
 * The team-building wheel that runs before a tournament, and again between the World
 * Tournament's group stage and its knockout bracket.
 *
 * Tournament opponents always field six, so this wheel only offers outcomes that put
 * Pokémon in the party or the box — no potions, no trainer battles, no roadblocks. It
 * reuses the container's existing handlers, so the encounters behave exactly as they do
 * during a normal run.
 */
@Component({
  selector: 'app-tournament-prep-roulette',
  standalone: true,
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './tournament-prep-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tournament-prep-roulette.component.css',
})
export class TournamentPrepRouletteComponent {
  @Input() respinReason = '';

  @Output() catchPokemonEvent = new EventEmitter<void>();
  @Output() catchTwoPokemonEvent = new EventEmitter<void>();
  @Output() goFishingEvent = new EventEmitter<void>();
  @Output() exploreCaveEvent = new EventEmitter<void>();
  @Output() legendaryEncounterEvent = new EventEmitter<void>();

  actions: WheelItem[] = [
    { text: 'Catch a Pokémon', fillStyle: 'crimson', weight: 3 },
    { text: 'Catch two Pokémon', fillStyle: 'darkcyan', weight: 1 },
    { text: 'Go Fishing', fillStyle: 'purple', weight: 1 },
    { text: 'Explore a Cave', fillStyle: 'green', weight: 1 },
    { text: 'Legendary Encounter', fillStyle: 'darkgoldenrod', weight: 1 },
  ];

  onItemSelected(index: number): void {
    switch (index) {
      case 0:
        this.catchPokemonEvent.emit();
        break;
      case 1:
        this.catchTwoPokemonEvent.emit();
        break;
      case 2:
        this.goFishingEvent.emit();
        break;
      case 3:
        this.exploreCaveEvent.emit();
        break;
      case 4:
        this.legendaryEncounterEvent.emit();
        break;
    }
  }
}
