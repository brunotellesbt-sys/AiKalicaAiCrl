
import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { WheelItem } from '../../../../interfaces/wheel-item';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { GenerationService } from '../../../../services/generation-service/generation.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { RunService } from '../../../../services/run-service/run.service';
import {
  EnemyPokemon,
  EnemyTeamService,
  TypeAdvantage,
} from '../../../../services/enemy-team-service/enemy-team.service';
import { villainBossTeamSize } from '../../../../services/enemy-team-service/enemy-team-size';
import { buildVictoryOdds } from '../../../../services/enemy-team-service/victory-odds';

/** The boss is fought after the 8th badge, so Classic mode weights him accordingly. */
const LAST_GYM_ROUND = 8;
import { villainBossTypesByGeneration } from '../../../../data/trainer-type-themes';
import { villainBossAceByGeneration, villainBossTeamsByGeneration } from '../../../../data/trainer-teams';
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';
import { villainTeamByGeneration } from '../../../../data/generation-encounters';
import { ItemItem } from '../../../../interfaces/item-item';
import { BattleRetryService } from '../../../../services/battle-retry-service/battle-retry.service';

/**
 * The boss used to spin a bespoke two-slice wheel ("You defeat them" / "They steal a
 * Pokémon"), which ignored how strong either side actually was — a losing matchup showed
 * three steal slices against one win and nothing else moved it. It now uses the same
 * victory wheel as every other battle in the game, so power, typing and team size all
 * count. Losing still costs a Pokémon, a life and a trip back to an earlier wheel; that
 * is handled by the container.
 */

@Component({
  selector: 'app-villain-boss-roulette',
  imports: [WheelComponent, ImgFallbackDirective, EnemyTeamPanelComponent, TranslatePipe],
  templateUrl: './villain-boss-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './villain-boss-roulette.component.css',
})
export class VillainBossRouletteComponent implements OnInit {
  constructor(
    private modalService: NgbModal,
    private generationService: GenerationService,
    private trainerService: TrainerService,
    private runService: RunService,
    private enemyTeamService: EnemyTeamService,
    private battleRetryService: BattleRetryService,
    private translate: TranslateService
  ) {}

  @Output() defeatVillainEvent = new EventEmitter<void>();
  /**
   * Losing the boss battle means the villain team steals one of your Pokémon.
   * (No "run away" option for this finale encounter.)
   */
  @Output() stealPokemonEvent = new EventEmitter<void>();

  @ViewChild('itemUsedModal', { static: true })
  itemUsedModal!: TemplateRef<any>;

  @ViewChild('villainBossModal', { static: true })
  villainBossModal!: TemplateRef<any>;

  villainTeamName = 'Villain Team';
  villainTeamBlurb = '';
  villainLeaderName = '';
  villainLeaderSpriteUrl = '';
  villainLeaderBlurb = '';

  outcomes: WheelItem[] = [];

  trainerItems: ItemItem[] = [];
  currentItem?: ItemItem;
  /** Extra spins bought with a potion. */
  retries = 0;

  /** Type Advantage mode only — empty in Classic. */
  enemyTeam: EnemyPokemon[] = [];
  typeAdvantage: TypeAdvantage | null = null;
  playerTeam: PokemonItem[] = [];

  get isTypeAdvantageMode(): boolean {
    return this.runService.isTypeAdvantageMode;
  }

  /** Index of the boss on screen, so the roster lookup matches them. */
  bossIndex = 0;
  /** Wheel of possible bosses, for the regions that have more than one. */
  bossChoices: WheelItem[] = [];
  choosingBoss = false;

  /** The wheel stopped: that professor (or admin) is the one waiting for you. */
  onBossChosen(index: number): void {
    const genId = this.generationService.getCurrentGeneration().id;
    const leaders = (villainTeamByGeneration[genId] ?? villainTeamByGeneration[1]).leaders ?? [];

    this.bossIndex = index >= 0 && index < leaders.length ? index : 0;
    const leader = leaders[this.bossIndex];
    if (leader) {
      this.villainLeaderName = leader.name;
      this.villainLeaderSpriteUrl = leader.spriteUrl;
      this.villainLeaderBlurb = leader.blurb;
    }

    this.choosingBoss = false;
    this.buildEnemyTeam(genId);
    this.calcVictoryOdds();
  }

  /** The boss shows up after the 8th badge, so the squad matches the hardest rung. */
  private buildEnemyTeam(genId: number): void {
    this.playerTeam = this.trainerService.getTeam() ?? [];

    if (!this.isTypeAdvantageMode) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    this.enemyTeam = this.enemyTeamService.buildTeam(
      (villainBossTeamsByGeneration[genId] ?? [])[this.bossIndex] ?? [],
      genId,
      villainBossTypesByGeneration[genId] ?? [],
      villainBossTeamSize(this.playerTeam.length),
      `villain:${genId}:${this.bossIndex}`,
      {
        fullyEvolved: true,
        aceId: (villainBossAceByGeneration[genId] ?? [])[this.bossIndex] ?? 0,
      }
    );

    this.typeAdvantage = this.enemyTeamService.scoreAdvantage(this.playerTeam, this.enemyTeam);
  }

  ngOnInit(): void {
    const genId = this.generationService.getCurrentGeneration().id;
    const encounter = villainTeamByGeneration[genId] ?? villainTeamByGeneration[1];

    this.villainTeamName = encounter.teamName;
    this.villainTeamBlurb = encounter.blurb;

    // Hoenn picks between Magma and Aqua, Paldea between Sada and Turo — spin for it
    // rather than deciding silently.
    const leaders = encounter.leaders ?? [];
    if (leaders.length > 1) {
      const colours = ['crimson', 'darkcyan'];
      this.bossChoices = leaders.map((boss, i) => ({
        text: boss.name,
        fillStyle: colours[i % colours.length],
        weight: 1,
      }));
      this.choosingBoss = true;
    } else {
      this.onBossChosen(0);
    }

    this.trainerItems = this.trainerService.getItems();

    this.buildEnemyTeam(genId);
    this.calcVictoryOdds();

    this.modalService.open(this.villainBossModal, {
      centered: true,
      size: 'lg',
    });
  }

  onItemSelected(index: number): void {
    this.retries--;

    if (this.outcomes[index]?.text === 'Yes') {
      this.defeatVillainEvent.emit();
      return;
    }

    if (this.retries > 0) return;

    // A potion buys another spin before the loss is committed, same as every other battle.
    const potion = this.battleRetryService.findPotion(this.trainerItems);
    if (potion) {
      this.usePotion(potion);
      return;
    }

    this.stealPokemonEvent.emit();
  }

  /** Same model as every other battle; the boss is an 8th-badge opponent. */
  private calcVictoryOdds(): void {
    this.outcomes = buildVictoryOdds({
      playerTeam: this.playerTeam ?? [],
      items: this.trainerItems ?? [],
      currentRound: LAST_GYM_ROUND,
      enemyTeam: this.enemyTeam ?? [],
      typeAdvantage: this.typeAdvantage,
      isTypeAdvantageMode: this.isTypeAdvantageMode,
    });
  }

  private usePotion(potion: ItemItem): void {
    this.currentItem = potion;
    this.retries = this.battleRetryService.consume(potion, this.trainerItems);

    this.modalService.open(this.itemUsedModal, { centered: true, size: 'md' });
  }

  itemName(item: ItemItem | undefined): string {
    return item ? this.translate.instant(item.text) : '';
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }
}
