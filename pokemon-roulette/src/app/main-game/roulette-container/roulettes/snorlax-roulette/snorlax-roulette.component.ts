import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';

import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { roadblockByGeneration } from '../../../../data/generation-encounters';
import { EventSource } from '../../../EventSource';

@Component({
  selector: 'app-snorlax-roulette',
  imports: [WheelComponent],
  templateUrl: './snorlax-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './snorlax-roulette.component.css',
})
export class SnorlaxRouletteComponent implements OnInit, OnDestroy {
  // Kept for backwards compatibility with the roulette container template.
  // (The encounter itself does not currently change behavior per round.)
  @Input() currentRound = 0;

  @Output() catchSnorlaxEvent = new EventEmitter<void>();
  @Output() runAwayEvent = new EventEmitter<void>();
  @Output() defeatSnorlaxEvent = new EventEmitter<EventSource>();

  roadblockNameKey = 'pokemon.snorlax';
  roadblockName = 'Snorlax';
  // Kept for data compatibility (no longer shown in the UI).
  roadblockBlurb = '';
  roadblockSpriteUrl = '';

  roadblockOdds: WheelItem[] = [];

  private sub: Subscription | null = null;
  private spriteSub: Subscription | null = null;

  constructor(
    private generationService: GenerationService,
    private pokemonService: PokemonService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Update whenever generation changes.
    this.sub = this.generationService.getGeneration().subscribe((gen) => {
      const roadblock = roadblockByGeneration[gen.id] || roadblockByGeneration[1];
      this.roadblockNameKey = roadblock.pokemonNameKey;
      this.roadblockBlurb = roadblock.blurb;

      // Translate name once (wheel uses raw strings).
      this.roadblockName = this.translate.instant(this.roadblockNameKey);

      // Sprite: prefer live fetch from PokeAPI so Gen 9+ roadblocks always have art.
      this.spriteSub?.unsubscribe();
      this.spriteSub = this.pokemonService.getPokemonSprites(roadblock.pokemonId).subscribe({
        next: (res) => {
          this.roadblockSpriteUrl = res?.sprite?.front_default || '';
        },
        error: () => {
          // Fallback to local dex dataset (older gens) if the API is unavailable.
          const pkmn = this.pokemonService.getPokemonById(roadblock.pokemonId);
          this.roadblockSpriteUrl = pkmn?.sprite?.front_default || '';
        },
      });

      this.roadblockOdds = [
        {
          text: `Catch ${this.roadblockName}`,
          fillStyle: 'green',
          weight: 1,
        },
        {
          text: `Run away`,
          fillStyle: 'crimson',
          weight: 1,
        },
        {
          text: `Defeat ${this.roadblockName}`,
          fillStyle: '#0d6efd',
          weight: 1,
        },
      ];
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onItemSelected(index: number): void {
    if (index === 0) {
      this.catchSnorlaxEvent.emit();
      return;
    }

    if (index === 1) {
      this.runAwayEvent.emit();
      return;
    }

    this.defeatSnorlaxEvent.emit('snorlax-encounter');
  }
}
