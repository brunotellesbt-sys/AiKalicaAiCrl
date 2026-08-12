import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { gymLeadersByGeneration } from './gym-leaders-by-generation';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import {
  gymLeaderTeamSize,
  maxEvolutionStage,
  opponentCanMegaEvolve,
  shouldBeFullyEvolved,
} from '../../../../services/enemy-team-service/enemy-team-size';
import { gymLeaderTypesByGeneration } from '../../../../data/trainer-type-themes';
import { gymLeaderAcesByGeneration, gymLeaderTeamsByGeneration } from '../../../../data/trainer-teams';
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';

@Component({
  selector: 'app-gym-battle-roulette',
  imports: [
    ImgFallbackDirective,
    WheelComponent,
    TranslatePipe,
    EnemyTeamPanelComponent
],
  templateUrl: './gym-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gym-battle-roulette.component.css'
})
export class GymBattleRouletteComponent implements OnInit, OnDestroy {

  gymLeadersByGeneration = gymLeadersByGeneration;

  constructor(
    private modalService: NgbModal,
    private gameStateService: GameStateService,
    private generationService: GenerationService,
    private trainerService: TrainerService,
    private translate: TranslateService,
    private runService: RunService,
    private enemyTeamService: EnemyTeamService
  ) { }

  private gameSubscription: Subscription | null = null;
  private generationSubscription: Subscription | null = null;

  @ViewChild('gymLeaderPresentationModal', { static: true }) gymLeaderPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  generation!: GenerationItem;
  trainerTeam!: PokemonItem[];
  trainerItems!: ItemItem[];
  @Input() currentRound!: number;
  @Input() fromLeader!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();
  @Output() fromLeaderChange = new EventEmitter<number>();

  victoryOdds: WheelItem[] = [
    { text: 'Yes', fillStyle: 'green', weight: 1 },
    { text: 'No', fillStyle: 'crimson', weight: 1 }
  ];

  currentLeader!: GymLeader;
  currentItem!: ItemItem;
  retries = 0;
  private teamSubscription!: Subscription;

  /** Type Advantage mode only — empty in Classic. */
  enemyTeam: EnemyPokemon[] = [];
  typeAdvantage: TypeAdvantage | null = null;

  get isTypeAdvantageMode(): boolean {
    return this.runService.isTypeAdvantageMode;
  }

  ngOnInit(): void {
    this.generationSubscription = this.generationService.getGeneration().subscribe(gen => {
      this.generation = gen;
    });

    this.trainerItems = this.trainerService.getItems();

    this.teamSubscription = this.trainerService.getTeamObservable().subscribe(team => {
      this.trainerTeam = team;
      this.buildEnemyTeam();
      this.calcVictoryOdds();
    });

    this.gameSubscription = this.gameStateService.currentState.subscribe(state => {
      if (state === 'gym-battle') {
        this.currentLeader = this.getCurrentLeader();
        this.buildEnemyTeam();
        this.calcVictoryOdds();

        this.modalService.open(this.gymLeaderPresentationModal, {
          centered: true,
          size: 'lg'
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
    } else {
      if (this.retries <= 0) {
        const potion = this.hasPotions();
        if (potion) {
          this.usePotion(potion);
        } else {
          this.battleResultEvent.emit(false);
        }
      }
    }
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

  /** Builds the leader's squad and scores it against the player's team. */
  private buildEnemyTeam(): void {
    if (!this.isTypeAdvantageMode || !this.generation) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    const themes = gymLeaderTypesByGeneration[this.generation.id] ?? [];
    const theme = themes[this.currentRound] ?? [];
    const roster = (gymLeaderTeamsByGeneration[this.generation.id] ?? [])[this.currentRound] ?? [];
    const size = gymLeaderTeamSize(this.currentRound, this.trainerTeam?.length ?? 0);

    this.enemyTeam = this.enemyTeamService.buildTeam(
      roster,
      this.generation.id,
      theme,
      size,
      `gym:${this.generation.id}:${this.currentRound}`,
      {
        fullyEvolved: shouldBeFullyEvolved(this.currentRound),
        maxStage: maxEvolutionStage(this.currentRound),
        allowMega: opponentCanMegaEvolve(this.currentRound),
        aceId: (gymLeaderAcesByGeneration[this.generation.id] ?? [])[this.currentRound] ?? 0,
      }
    );

    this.typeAdvantage = this.enemyTeamService.scoreAdvantage(this.trainerTeam ?? [], this.enemyTeam);
  }


  private getCurrentLeader(): GymLeader {

    const ladder = this.gymLeadersByGeneration[this.generation.id] ?? [];

    // Clamped rather than indexed raw.
    //
    // The round counter free-runs: it is bumped as a side effect of leaving a battle state
    // and rewound by hand on the paths that replay one, so any desync anywhere upstream
    // lands here as an index past the eighth leader. That used to evaluate to undefined and
    // take the run down with it — the reported freeze on the way to the Elite Four — which
    // is a bad way to find out about an off-by-one. Clamping turns a wrong index into the
    // wrong leader, which is survivable and visible, instead of a dead run.
    const index = Math.min(Math.max(this.currentRound, 0), ladder.length - 1);

    if (index !== this.currentRound) {
      console.warn(
        `[gym] round ${this.currentRound} is outside the ${ladder.length}-leader ladder for ` +
          `generation ${this.generation.id}; clamped to ${index}.`
      );
    }

    let currentLeader = ladder[index];

    // Version-dependent gyms (and similar cases) are represented by an array of sprites.
    // Pick the SAME index for sprite + quote and emit it, so the container can award the
    // correct badge when the badge data also has variants.
    if (Array.isArray(currentLeader.sprite)) {
      const leaderSprites = currentLeader.sprite;
      const leaderQuotes = currentLeader.quotes || [];
      const randomIndex = Math.floor(Math.random() * leaderSprites.length);

      this.fromLeaderChange.emit(randomIndex);

      currentLeader = {
        // Keep the combined translated name (e.g. "Bea/Allister")—the quote/sprite will
        // reflect the selected leader.
        name: currentLeader.name,
        sprite: leaderSprites[randomIndex] ?? leaderSprites[0],
        quotes: leaderQuotes[randomIndex] ? [leaderQuotes[randomIndex]] : (leaderQuotes[0] ? [leaderQuotes[0]] : [])
      };
    } else {
      // Reset to 0 so downstream consumers never keep a stale index.
      this.fromLeaderChange.emit(0);

      // For single-leader gyms, randomize which quote shows in the intro.
      const leaderQuotes = currentLeader.quotes || [];
      if (leaderQuotes.length > 1) {
        const randomQuote = leaderQuotes[Math.floor(Math.random() * leaderQuotes.length)];
        currentLeader = {
          ...currentLeader,
          quotes: [randomQuote]
        };
      }
    }

    return currentLeader;
  }

  private hasPotions(): ItemItem | undefined {
    const potionItem = this.trainerItems.find(item =>
      item.name === 'potion' || item.name === 'super-potion' || item.name === 'hyper-potion'
    );
    return potionItem;
  }

  itemName(item: ItemItem | undefined): string {
    if (!item) return '';
    const key = item.text || '';
    const value = this.translate.instant(key);
    if (this.isRawKey(value, key)) {
      return this.titleCaseFromToken(item.name || key);
    }
    return value;
  }

  itemDescription(item: ItemItem | undefined): string {
    if (!item) return '';
    const key = item.description || '';
    const value = this.translate.instant(key);
    // If missing/unloaded, don't show raw keys.
    if (this.isRawKey(value, key)) return '';
    return value;
  }

  private isRawKey(value: string, key: string): boolean {
    const v = (value || '').toString().trim();
    const k = (key || '').toString().trim();
    return !v || v === k || v.startsWith('items.') || v.includes('.name') || v.includes('.description');
  }

  private titleCaseFromToken(token: string): string {
    return (token || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private usePotion(potion: ItemItem): void {
    const index = this.trainerItems.indexOf(potion);
    this.currentItem = potion;
    if (index !== -1) {
      this.trainerItems.splice(index, 1);
      this.trainerService.removeItem(potion);
    }

    switch (potion.name) {
      case 'potion':
        this.retries = 1;
        break;
      case 'super-potion':
        this.retries = 2;
        break;
      case 'hyper-potion':
        this.retries = 3;
        break;
    }

    this.modalService.open(this.itemUsedModal, {
      centered: true,
      size: 'md'
    });
  }
}
