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
import { VillainTeamService } from '../../../../services/villain-team-service/villain-team.service';
import { VillainGrunt, VillainTeam } from '../../../../data/villain-teams';

/**
 * A roadside run-in with the region's villain team.
 *
 * Historic component name, kept because the container and its template still address it by
 * that selector; it has shown the generation-appropriate organisation for a while.
 *
 * Two things changed here. The encounter now draws a *grunt* rather than the boss — a boss
 * who turns up at every mugging is not a boss by the time you reach the one fight that is
 * supposed to be the region's climax. And in a region with rival teams the organisation is
 * rolled per encounter, then reported upward, so whatever gets stolen is filed against the
 * team that actually took it.
 */
@Component({
  selector: 'app-team-rocket-roulette',
  imports: [WheelComponent, ImgFallbackDirective],
  templateUrl: './team-rocket-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-rocket-roulette.component.css',
})
export class TeamRocketRouletteComponent implements OnInit {
  constructor(
    private modalService: NgbModal,
    private generationService: GenerationService,
    private villainTeamService: VillainTeamService
  ) {}

  @Input() stolenPokemon!: PokemonItem | null;
  @Output() stealPokemonEvent = new EventEmitter<void>();
  @Output() nothingHappensEvent = new EventEmitter<void>();
  @Output() defeatInBattleEvent = new EventEmitter<void>();

  @ViewChild('teamRockerModal', { static: true })
  teamRockerModal!: TemplateRef<any>;

  team: VillainTeam | null = null;
  grunt: VillainGrunt | null = null;

  outcomes: WheelItem[] = [];

  get teamName(): string {
    return this.team?.name ?? 'Team Rocket';
  }

  /** Drives the team's colour into the panel, so Magma and Aqua never look alike. */
  get teamColour(): string {
    return this.team?.colour ?? '#1b1b1b';
  }

  get gruntName(): string {
    return this.grunt?.name ?? 'Grunt';
  }

  get gruntSpriteUrl(): string {
    return this.grunt?.spriteUrl ?? '';
  }

  ngOnInit(): void {
    const genId = this.generationService.getCurrentGeneration().id;

    // Rolled per encounter: in Hoenn this is the Magma-or-Aqua question, everywhere else it
    // is the region's only team and the roll is a formality.
    this.team = this.villainTeamService.rollTeam(genId);
    if (this.team) {
      this.villainTeamService.beginEncounter(this.team, 'roadside');
      this.grunt = this.villainTeamService.currentGrunt;
    }

    // Original wheel balance kept: stealing and running are common, and beating them is far
    // more likely once they are holding something, so a loss is recoverable rather than final.
    this.outcomes = [
      { text: `${this.teamName} steals a Pokémon`, fillStyle: 'crimson', weight: 2 },
      { text: 'You run away', fillStyle: 'darkorange', weight: 2 },
      {
        text: `You defeat ${this.teamName}`,
        fillStyle: 'green',
        weight: this.holdsAnything ? 4 : 1,
      },
    ];

    this.modalService.open(this.teamRockerModal, { centered: true, size: 'lg' });
  }

  /**
   * Whether beating *this* team would actually give something back.
   *
   * Reads the team's own haul rather than a single run-wide "stolen" slot, because with
   * rival teams those are different questions: Aqua holding your Wingull is no reason to
   * make Magma easier to beat.
   */
  private get holdsAnything(): boolean {
    if (this.team && this.villainTeamService.heldBy(this.team.id).length) return true;
    return !!this.stolenPokemon;
  }

  onItemSelected(index: number): void {
    switch (this.outcomes[index]?.fillStyle) {
      case 'crimson':
        this.stealPokemonEvent.emit();
        break;
      case 'darkorange':
        this.nothingHappensEvent.emit();
        break;
      case 'green':
        this.defeatInBattleEvent.emit();
        break;
    }
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }
}
