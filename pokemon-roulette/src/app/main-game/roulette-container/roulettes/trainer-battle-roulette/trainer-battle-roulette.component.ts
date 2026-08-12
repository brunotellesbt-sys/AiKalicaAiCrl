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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { GenerationItem } from '../../../../interfaces/generation-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import {
  EncounterCharacter,
  battleTrainerByGeneration,
  protagonistCharacterByGeneration,
} from '../../../../data/generation-encounters';
import { COUNTERPART_RIVAL_GENERATIONS } from '../rival-battle-roulette/rival-by-generation';
import { preferredMegaFor } from '../../../../data/preferred-megas';
import { RunService } from '../../../../services/run-service/run.service';
import {
  EnemyPokemon,
  EnemyTeamService,
  TypeAdvantage,
} from '../../../../services/enemy-team-service/enemy-team.service';
import { buildVictoryOdds } from '../../../../services/enemy-team-service/victory-odds';
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';
import { BATTLE_TRAINER_TYPES } from '../../../../data/trainer-type-themes';
import {
  battleTrainerAceByGeneration,
  battleTrainerTeamsByGeneration,
  femaleProtagonistAceByGeneration,
  femaleProtagonistTeamsByGeneration,
  protagonistAceByGeneration,
  protagonistTeamsByGeneration,
} from '../../../../data/trainer-teams';
import {
  scaledTrainerTeamSize,
  maxEvolutionStage,
  opponentCanMegaEvolve,
  shouldBeFullyEvolved,
} from '../../../../services/enemy-team-service/enemy-team-size';
import { BattleRetryService } from '../../../../services/battle-retry-service/battle-retry.service';

/**
 * Roadside trainer battle.
 *
 * This encounter used to be flavour only — it showed the trainer and then jumped straight
 * to the evolution reward, with no fight at all. It is now a real battle: the trainer
 * brings the team they use in the games, scaled to the gym the player is heading towards,
 * and losing costs a potion or a life like any other battle.
 */
@Component({
  selector: 'app-trainer-battle-roulette',
  standalone: true,
  imports: [ImgFallbackDirective, WheelComponent, TranslatePipe, EnemyTeamPanelComponent],
  templateUrl: './trainer-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './trainer-battle-roulette.component.css',
})
export class TrainerBattleRouletteComponent implements OnInit, OnDestroy {
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
  private teamSubscription: Subscription | null = null;

  @ViewChild('trainerPresentationModal', { static: true })
  trainerPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true })
  itemUsedModal!: TemplateRef<any>;

  generation!: GenerationItem;
  trainerTeam: PokemonItem[] = [];
  trainerItems: ItemItem[] = [];

  @Input() currentRound = 0;
  @Output() battleResultEvent = new EventEmitter<boolean>();

  victoryOdds: WheelItem[] = [];
  opponent: EncounterCharacter | null = null;
  /** Index of the chosen trainer, so the roster lookup matches who is on screen. */
  opponentIndex = 0;
  /** Wheel of the region's trainers, spun before the battle to pick the opponent. */
  trainerChoices: WheelItem[] = [];
  choosingOpponent = false;
  currentItem?: ItemItem;
  retries = 0;

  /** Type Advantage mode only — empty in Classic. */
  enemyTeam: EnemyPokemon[] = [];
  typeAdvantage: TypeAdvantage | null = null;

  get isTypeAdvantageMode(): boolean {
    return this.runService.isTypeAdvantageMode;
  }

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
      if (state !== 'trainer-battle') return;

      // One wheel to decide who shows up, then the battle itself. A region with a single
      // trainer skips straight past the choice.
      this.buildTrainerChoices();

      if (this.trainerChoices.length > 1) {
        this.choosingOpponent = true;
        this.opponent = null;
        return;
      }

      this.onTrainerChosen(0);
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

    const potion = this.battleRetryService.findPotion(this.trainerItems);
    if (potion) {
      this.usePotion(potion);
      return;
    }

    this.battleResultEvent.emit(false);
  }

  itemName(item: ItemItem | undefined): string {
    return item ? this.translate.instant(item.text) : '';
  }

  private usePotion(potion: ItemItem): void {
    this.currentItem = potion;
    this.retries = this.battleRetryService.consume(potion, this.trainerItems);

    this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' });
  }

  /** Everyone the region can put in front of you, counterpart protagonist included. */
  private opponentPool(): EncounterCharacter[] {
    const gen = this.generation?.id;
    if (!gen) return [];

    const pool = [...(battleTrainerByGeneration[gen] ?? [])];

    // Hoenn and Kalos make the counterpart the rival, so they must not also meet you here.
    if (!COUNTERPART_RIVAL_GENERATIONS.includes(gen)) {
      const pair = protagonistCharacterByGeneration[gen];
      const counterpart = pair
        ? pair[this.trainerService.gender === 'female' ? 'male' : 'female']
        : null;
      if (counterpart) pool.push(counterpart);
    }

    return pool;
  }

  /** Builds the wheel that decides which of the region's trainers turns up. */
  private buildTrainerChoices(): void {
    const colours = ['crimson', 'darkorange', 'darkcyan', 'green', 'purple', 'darkgoldenrod'];
    this.trainerChoices = this.opponentPool().map((trainer, i) => ({
      text: trainer.name,
      fillStyle: colours[i % colours.length],
      weight: 1,
    }));
  }

  /** The wheel stopped: lock in that trainer and open the battle. */
  onTrainerChosen(index: number): void {
    const pool = this.opponentPool();
    this.opponentIndex = index >= 0 && index < pool.length ? index : 0;
    this.opponent = pool[this.opponentIndex] ?? null;
    this.choosingOpponent = false;

    this.buildEnemyTeam();
    this.calcVictoryOdds();

    this.modalService.open(this.trainerPresentationModal, { centered: true, size: 'lg' });
  }

  /** Same odds model as every other battle. */
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


  /** Scales to the gym the player is heading towards, like the rival does. */
  private buildEnemyTeam(): void {
    if (!this.isTypeAdvantageMode || !this.generation) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    const nextGym = Math.min(this.currentRound, 7);
    const pool = this.opponentPool();
    const isCounterpart = this.opponentIndex >= (battleTrainerByGeneration[this.generation.id] ?? []).length;

    // The counterpart protagonist's roster lives in its own table.
    const roster = isCounterpart
      ? (this.trainerService.gender === 'female'
          ? protagonistTeamsByGeneration
          : femaleProtagonistTeamsByGeneration)[this.generation.id] ?? []
      : (battleTrainerTeamsByGeneration[this.generation.id] ?? [])[this.opponentIndex] ?? [];

    const ace = isCounterpart
      ? (this.trainerService.gender === 'female'
          ? protagonistAceByGeneration
          : femaleProtagonistAceByGeneration)[this.generation.id] ?? 0
      : (battleTrainerAceByGeneration[this.generation.id] ?? [])[this.opponentIndex] ?? 0;

    this.enemyTeam = this.enemyTeamService.buildTeam(
      roster,
      this.generation.id,
      BATTLE_TRAINER_TYPES,
      scaledTrainerTeamSize(nextGym, this.trainerTeam?.length ?? 0),
      `trainer:${this.generation.id}:${this.opponentIndex}:${nextGym}`,
      {
        fullyEvolved: shouldBeFullyEvolved(nextGym),
        maxStage: maxEvolutionStage(nextGym),
        allowMega: opponentCanMegaEvolve(nextGym),
        aceId: ace,
        preferredMegaForm: preferredMegaFor(this.opponent?.name ?? ''),
      }
    );

    this.typeAdvantage = this.enemyTeamService.scoreAdvantage(this.trainerTeam ?? [], this.enemyTeam);
  }
}
