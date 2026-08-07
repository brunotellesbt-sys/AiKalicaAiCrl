
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { villainTeamByGeneration } from '../../../../data/generation-encounters';

/**
 * Historic component name kept for compatibility, but it now shows the
 * generation-appropriate villain team (Rocket, Magma/Aqua, Galactic, etc.).
 */
@Component({
  selector: 'app-team-rocket-roulette',
  imports: [WheelComponent, ImgFallbackDirective],
  templateUrl: './team-rocket-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-rocket-roulette.component.css',
})
export class TeamRocketRouletteComponent implements OnInit {
  constructor(private modalService: NgbModal, private generationService: GenerationService) {}

  // Existing API used by roulette-container.component.html
  @Input() stolenPokemon!: PokemonItem | null;
  @Output() stealPokemonEvent = new EventEmitter<void>();
  @Output() nothingHappensEvent = new EventEmitter<void>();
  @Output() defeatInBattleEvent = new EventEmitter<void>();

  @ViewChild('teamRockerModal', { static: true })
  teamRockerModal!: TemplateRef<any>;

  // Villain encounter data (dynamic per generation)
  villainTeamName = 'Team Rocket';
  villainTeamBlurb = '';
  villainLeaderName = 'Giovanni';
  villainLeaderSpriteUrl = '';
  villainLeaderBlurb = '';

  // Wheel items
  outcomes: WheelItem[] = [];

  ngOnInit(): void {
    const genId = this.generationService.getCurrentGeneration().id;
    const encounter = villainTeamByGeneration[genId] ?? villainTeamByGeneration[1];

    this.villainTeamName = encounter.teamName;
    this.villainTeamBlurb = encounter.blurb;

    const leaders = encounter.leaders ?? [];
    const leader = leaders[Math.floor(Math.random() * Math.max(leaders.length, 1))] ?? leaders[0];
    if (leader) {
      this.villainLeaderName = leader.name;
      this.villainLeaderSpriteUrl = leader.spriteUrl;
      this.villainLeaderBlurb = leader.blurb;
    }

    // Keep the original wheel balance:
    // - Steal / run are common
    // - "Defeat" is much more likely if they already stole a Pokémon (so you can get it back)
    this.outcomes = [
      { text: `${this.villainTeamName} steals a Pokémon`, fillStyle: 'crimson', weight: 2 },
      { text: 'You run away', fillStyle: 'darkorange', weight: 2 },
      {
        text: `You defeat ${this.villainTeamName}`,
        fillStyle: 'green',
        weight: this.stolenPokemon ? 4 : 1,
      },
    ];

    this.modalService.open(this.teamRockerModal, {
      centered: true,
      size: 'lg',
    });
  }

  onItemSelected(index: number): void {
    switch (index) {
      case 0:
        this.stealPokemonEvent.emit();
        break;
      case 1:
        this.nothingHappensEvent.emit();
        break;
      case 2:
        this.defeatInBattleEvent.emit();
        break;
    }
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }
}
