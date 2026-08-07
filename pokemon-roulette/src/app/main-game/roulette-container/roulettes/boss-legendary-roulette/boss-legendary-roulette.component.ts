import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { PokemonService } from '../../../../services/pokemon-service/pokemon.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { mainLegendaryIdsByGeneration } from '../../../../data/main-legendaries-by-generation';
import { regionNameByGeneration } from '../../../../data/regions-by-generation';

@Component({
  selector: 'app-boss-legendary-roulette',
  imports: [WheelComponent],
  templateUrl: './boss-legendary-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './boss-legendary-roulette.component.css',
})
export class BossLegendaryRouletteComponent implements OnInit, OnDestroy {
  constructor(private generationService: GenerationService, private pokemonService: PokemonService) {}

  generation!: GenerationItem;
  regionName = 'Kanto';

  @Output() selectedPokemonEvent = new EventEmitter<PokemonItem>();

  private generationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe((gen) => {
      this.generation = gen;
      this.regionName = regionNameByGeneration[gen.id] ?? 'Kanto';
    });
  }

  ngOnDestroy(): void {
    this.generationSubscription?.unsubscribe();
  }

  getBossLegendaries(): PokemonItem[] {
    const genId = this.generation?.id ?? 1;
    const ids = mainLegendaryIdsByGeneration[genId] ?? mainLegendaryIdsByGeneration[1];
    return ids
      .map((id) => this.pokemonService.getPokemonById(id))
      .filter((p): p is PokemonItem => !!p);
  }

  onItemSelected(index: number): void {
    const list = this.getBossLegendaries();
    const selected = list[index];
    if (selected) {
      this.selectedPokemonEvent.emit(selected);
    }
  }
}
