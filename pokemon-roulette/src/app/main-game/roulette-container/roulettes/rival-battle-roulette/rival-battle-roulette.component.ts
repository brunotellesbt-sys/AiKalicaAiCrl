import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { COUNTERPART_RIVAL_GENERATIONS, rivalByGeneration } from './rival-by-generation';
import { protagonistCharacterByGeneration } from '../../../../data/generation-encounters';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import { GymLeader } from '../../../../interfaces/gym-leader';
import { RunService } from '../../../../services/run-service/run.service';
import {
  EnemyPokemon,
  EnemyTeamService,
  TypeAdvantage,
} from '../../../../services/enemy-team-service/enemy-team.service';
import { buildVictoryOdds } from '../../../../services/enemy-team-service/victory-odds';
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';
import { RIVAL_TYPES } from '../../../../data/trainer-type-themes';
import {
  femaleProtagonistAceByGeneration,
  femaleProtagonistTeamsByGeneration,
  protagonistAceByGeneration,
  protagonistTeamsByGeneration,
  rivalAceByGeneration,
  rivalTeamsByGeneration,
} from '../../../../data/trainer-teams';
import { BattleRetryService } from '../../../../services/battle-retry-service/battle-retry.service';
import {
  scaledTrainerTeamSize,
  maxEvolutionStage,
  opponentCanMegaEvolve,
  shouldBeFullyEvolved,
} from '../../../../services/enemy-team-service/enemy-team-size';

@Component({
  selector: 'app-rival-battle-roulette',
  imports: [ImgFallbackDirective, WheelComponent, TranslatePipe, EnemyTeamPanelComponent],
  templateUrl: './rival-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './rival-battle-roulette.component.css',
})
export class RivalBattleRouletteComponent implements OnInit, OnDestroy {
  rivalByGeneration = rivalByGeneration;

  constructor(
    private modalService: NgbModal,
    private gameStateService: GameStateService,
    private generationService: GenerationService,
    private trainerService: TrainerService,
    private runService: RunService,
    private enemyTeamService: EnemyTeamService,
    private battleRetryService: BattleRetryService,
    private translate: TranslateService
  ) {}

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;

  @ViewChild('gymLeaderPresentationModal', { static: true })
  gymLeaderPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true })
  itemUsedModal!: TemplateRef<any>;

  generation!: GenerationItem;
  trainerTeam!: PokemonItem[];
  trainerItems!: ItemItem[];
  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();

  victoryOdds: WheelItem[] = [
    { text: 'Yes', fillStyle: 'green', weight: 1 },
    { text: 'No', fillStyle: 'crimson', weight: 1 },
  ];

  currentRival!: GymLeader;
  currentItem!: ItemItem;
  retries = 0;

  /** Type Advantage mode only — empty in Classic. */
  enemyTeam: EnemyPokemon[] = [];
  typeAdvantage: TypeAdvantage | null = null;

  get isTypeAdvantageMode(): boolean {
    return this.runService.isTypeAdvantageMode;
  }
  private teamSubscription!: Subscription;

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe((gen) => {
      this.generation = gen;
    });

    this.trainerItems = this.trainerService.getItems();

    this.teamSubscription = this.trainerService.getTeamObservable().subscribe((team) => {
      this.trainerTeam = team;
      this.buildEnemyTeam();
      this.calcVictoryOdds();
    });

    this.gameSubscription = this.gameStateService.currentState.subscribe((state) => {
      if (state === 'battle-rival') {
        this.currentRival = this.getCurrentRival();
        this.buildEnemyTeam();
        this.calcVictoryOdds();

        this.modalService.open(this.gymLeaderPresentationModal, {
          centered: true,
          size: 'lg',
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
    this.generationSubscription?.unsubscribe();
    this.teamSubscription?.unsubscribe();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  onItemSelected(slice: WheelItem): void {
    this.retries--;

    if (slice?.text === 'Yes') {
      this.battleResultEvent.emit(true);
      return;
    }

    if (this.retries > 0) return;

    // Rival fights used to ignore potions entirely; every battle now offers the re-spin.
    // Only where losing actually costs something, though — in Classic a lost rival battle
    // has no penalty, so burning a potion on it would be a trap.
    const potion = this.isTypeAdvantageMode
      ? this.battleRetryService.findPotion(this.trainerItems)
      : undefined;

    if (potion) {
      this.usePotion(potion);
      return;
    }

    this.battleResultEvent.emit(false);
  }

  private usePotion(potion: ItemItem): void {
    this.currentItem = potion;
    this.retries = this.battleRetryService.consume(potion, this.trainerItems);

    this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' });
  }

  itemName(item: ItemItem | undefined): string {
    return item ? this.translate.instant(item.text) : '';
  }

  private calcVictoryOdds(): void {
    this.victoryOdds = buildVictoryOdds({
      playerTeam: this.trainerTeam ?? [],
      items: this.trainerItems ?? [],
      currentRound: this.currentRound,
      enemyTeam: this.enemyTeam ?? [],
      typeAdvantage: this.typeAdvantage,
      isTypeAdvantageMode: this.isTypeAdvantageMode,
    });
  }

  /**
   * Builds the rival's squad and scores it.
   *
   * Rivals scale to the gym the player is heading towards, so an optional fight never
   * feels lighter or heavier than the badge it sits between.
   */
  private buildEnemyTeam(): void {
    if (!this.isTypeAdvantageMode || !this.generation) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    const nextGym = Math.min(this.currentRound, 7);
    // The counterpart rival brings the protagonist roster, not the fallback rival one.
    const useCounterpart = this.rivalIsCounterpart;
    const femaleRival = useCounterpart && this.trainerService.gender !== 'female';

    const roster = useCounterpart
      ? (femaleRival ? femaleProtagonistTeamsByGeneration : protagonistTeamsByGeneration)[this.generation.id] ?? []
      : rivalTeamsByGeneration[this.generation.id] ?? [];

    this.enemyTeam = this.enemyTeamService.buildTeam(
      roster,
      this.generation.id,
      RIVAL_TYPES,
      scaledTrainerTeamSize(nextGym, this.trainerTeam?.length ?? 0),
      `rival:${this.generation.id}:${nextGym}`,
      {
        fullyEvolved: shouldBeFullyEvolved(nextGym),
        maxStage: maxEvolutionStage(nextGym),
        allowMega: opponentCanMegaEvolve(nextGym),
        aceId: useCounterpart
          ? (femaleRival ? femaleProtagonistAceByGeneration : protagonistAceByGeneration)[this.generation.id] ?? 0
          : rivalAceByGeneration[this.generation.id] ?? 0,
      }
    );

    this.typeAdvantage = this.enemyTeamService.scoreAdvantage(this.trainerTeam ?? [], this.enemyTeam);
  }


  /** True when this region's rival is the protagonist the player did not pick. */
  private get rivalIsCounterpart(): boolean {
    return COUNTERPART_RIVAL_GENERATIONS.includes(this.generation?.id);
  }

  private getCurrentRival(): GymLeader {
    // Hoenn and Kalos pair you against your counterpart for the whole story, so the rival is
    // Brendan/May or Calem/Serena — whichever you are not playing as.
    if (this.rivalIsCounterpart) {
      const pair = protagonistCharacterByGeneration[this.generation.id];
      const counterpart = pair
        ? pair[this.trainerService.gender === 'female' ? 'male' : 'female']
        : null;

      if (counterpart) {
        return {
          name: counterpart.name,
          sprite: counterpart.spriteUrl,
          quotes: [this.translate.instant(counterpart.blurb)],
        };
      }
    }

    const options = this.rivalByGeneration[this.generation.id] || [];

    if (!options || options.length === 0) {
      return {
        name: 'Rival',
        sprite: '',
        quotes: ['...'],
      };
    }

    // One rival per region now — N moved to the Battle Trainer wheel.
    return options[0];
  }
}
