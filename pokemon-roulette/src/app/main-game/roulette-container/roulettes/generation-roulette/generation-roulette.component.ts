import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { DarkModeService } from '../../../../services/dark-mode-service/dark-mode.service';
import { Observable } from 'rxjs';
import { AssetPreloadService } from '../../../../services/asset-preload-service/asset-preload.service';

@Component({
  selector: 'app-generation-roulette',
  imports: [
    CommonModule,
    WheelComponent,
    TranslatePipe
  ],
  templateUrl: './generation-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './generation-roulette.component.css'
})
export class GenerationRouletteComponent {

  constructor(private generationService: GenerationService,
              private darkModeService: DarkModeService,
              private assetPreloadService: AssetPreloadService) {
    this.generations = this.generationService.getGenerationList();
    this.darkMode = this.darkModeService.darkMode$;
  }

  generations: GenerationItem[];
  darkMode!: Observable<boolean>;
  selectedGeneration: GenerationItem | null = null;
  showChoiceButtons = false;
  @Output() generationSelectedEvent = new EventEmitter<GenerationItem>();

  onItemSelected(index: number): void {
    this.selectedGeneration = this.generations[index];
    this.generationService.setGeneration(index);
    // Prefetch key assets for this generation (sprites/audio).
    this.assetPreloadService.preloadForGeneration(this.selectedGeneration?.id ?? 1);
    this.generationSelectedEvent.emit();
  }

  toggleChoiceView(): void {
    this.showChoiceButtons = !this.showChoiceButtons;
  }

  onGenerationChosen(index: number): void {
    this.selectedGeneration = this.generations[index];
    this.generationService.setGeneration(index);
    // Prefetch key assets for this generation (sprites/audio).
    this.assetPreloadService.preloadForGeneration(this.selectedGeneration?.id ?? 1);
    this.generationSelectedEvent.emit();
  }
}
