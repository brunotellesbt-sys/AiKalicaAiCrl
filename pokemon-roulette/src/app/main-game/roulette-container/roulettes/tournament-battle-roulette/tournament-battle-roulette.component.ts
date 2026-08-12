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
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ItemItem } from '../../../../interfaces/item-item';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { RunService } from '../../../../services/run-service/run.service';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';
import { TournamentBracketComponent } from '../../../../trainer-team/tournament-bracket/tournament-bracket.component';
import {
  EnemyPokemon,
  EnemyTeamService,
  TypeAdvantage,
} from '../../../../services/enemy-team-service/enemy-team.service';
import { buildVictoryOdds } from '../../../../services/enemy-team-service/victory-odds';
import {
  Competitor,
  TournamentService,
  TOURNAMENT_TEAM_SIZE,
} from '../../../../services/tournament-service/tournament.service';

/**
 * A single tournament match.
 *
 * Unlike every other battle in the game this one ignores the run's lives and item bag: the
 * opponent always brings a full six fully evolved Pokémon from their real roster, and the
 * only cushion is the phase's fixed Potion allowance. Losing ends the tournament.
 */
@Component({
  selector: 'app-tournament-battle-roulette',
  standalone: true,
  imports: [
    WheelComponent,
    TranslatePipe,
    ImgFallbackDirective,
    EnemyTeamPanelComponent,
    TournamentBracketComponent
],
  templateUrl: './tournament-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tournament-battle-roulette.component.css',
})
export class TournamentBattleRouletteComponent implements OnInit, OnDestroy {
  constructor(
    private modalService: NgbModal,
    private gameStateService: GameStateService,
    private trainerService: TrainerService,
    private runService: RunService,
    private enemyTeamService: EnemyTeamService,
    private tournamentService: TournamentService
  ) {}

  private gameSubscription: Subscription | null = null;
  private teamSubscription: Subscription | null = null;

  @ViewChild('opponentModal', { static: true }) opponentModal!: TemplateRef<any>;
  @ViewChild('potionModal', { static: true }) potionModal!: TemplateRef<any>;

  @Output() battleResultEvent = new EventEmitter<boolean>();

  trainerTeam: PokemonItem[] = [];
  trainerItems: ItemItem[] = [];

  victoryOdds: WheelItem[] = [];
  opponent: Competitor | null = null;
  enemyTeam: EnemyPokemon[] = [];
  typeAdvantage: TypeAdvantage | null = null;
  retries = 0;

  get isTypeAdvantageMode(): boolean {
    return this.runService.isTypeAdvantageMode;
  }

  get potionsLeft(): number {
    return this.tournamentService.potionsLeft;
  }

  /** True once the bracket has started — the only phase where a loss ends the run. */
  get isKnockout(): boolean {
    return this.tournamentService.stage === 'knockout';
  }

  /** Group matches are played for points, so the UI should not promise a safety net. */
  get showsPotions(): boolean {
    return this.isKnockout;
  }

  /**
   * "Win or go home" is only true once the bracket starts.
   *
   * Telling a player their group match is sudden death and then not eliminating them reads
   * as a bug, so the stakes line follows the phase.
   */
  get blurbKey(): string {
    return this.isKnockout
      ? 'game.main.tournament.battle.blurb'
      : 'game.main.tournament.battle.blurbGroups';
  }

  get phaseLabel(): string {
    return `game.main.tournament.phase.${this.tournamentService.stage}`;
  }

  ngOnInit(): void {
    this.trainerItems = this.trainerService.getItems();

    this.teamSubscription = this.trainerService.getTeamObservable().subscribe((team) => {
      this.trainerTeam = team;
      this.buildEnemyTeam();
      this.calcVictoryOdds();
    });

    this.gameSubscription = this.gameStateService.currentState.subscribe((state) => {
      if (state !== 'tournament-battle') return;

      this.opponent = this.tournamentService.currentOpponent();
      this.buildEnemyTeam();
      this.calcVictoryOdds();

      this.modalService.open(this.opponentModal, { centered: true, size: 'lg' });
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
    this.teamSubscription?.unsubscribe();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  get opponentName(): string {
    return this.opponent?.name ?? '';
  }

  /** A competitor's display name is sometimes a translation key, sometimes a literal. */
  isTranslationKey(name: string): boolean {
    return name.includes('.');
  }

  onItemSelected(slice: WheelItem): void {
    this.retries--;

    if (slice?.text === 'Yes') {
      this.battleResultEvent.emit(true);
      return;
    }

    if (this.retries > 0) return;

    // A Potion buys one more spin, but only once the bracket has started. A group-stage
    // loss costs points and nothing else — the player is still in the tournament — so
    // spending the run's single Potion there would burn it on a match that cannot end
    // anything. Losing a group match simply reports the result.
    if (this.isKnockout && this.tournamentService.usePotion()) {
      this.retries = 1;
      this.modalService.open(this.potionModal, { centered: true, size: 'md' });
      return;
    }

    this.battleResultEvent.emit(false);
  }

  /** Same odds model as every other battle in the game. */
  private calcVictoryOdds(): void {
    this.victoryOdds = buildVictoryOdds({
      playerTeam: this.trainerTeam ?? [],
      items: this.trainerItems ?? [],
      currentRound: 0,
      enemyTeam: this.enemyTeam ?? [],
      typeAdvantage: this.typeAdvantage,
      isTypeAdvantageMode: this.isTypeAdvantageMode,
      flatDifficulty: TOURNAMENT_TEAM_SIZE,
    });
  }


  private buildEnemyTeam(): void {
    if (!this.opponent) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    this.enemyTeam = this.enemyTeamService.buildTeam(
      this.opponent.roster,
      this.opponent.generationId,
      this.opponent.themeTypes,
      TOURNAMENT_TEAM_SIZE,
      `pwt:${this.opponent.id}`,
      {
        fullyEvolved: true, // every tournament entrant is fully evolved
        aceId: this.opponent.ace,
        preferredMegaForm: this.opponent.preferredMegaForm ?? '',
      }
    );

    this.typeAdvantage = this.isTypeAdvantageMode
      ? this.enemyTeamService.scoreAdvantage(this.trainerTeam ?? [], this.enemyTeam)
      : null;
  }
}
