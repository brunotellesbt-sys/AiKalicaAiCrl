import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { championByGeneration } from './champion-by-generation';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Subscription } from 'rxjs';
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
import { EnemyTeamPanelComponent } from '../../../enemy-team-panel/enemy-team-panel.component';
import { championTypesByGeneration } from '../../../../data/trainer-type-themes';
import { championAceByGeneration, championTeamsByGeneration } from '../../../../data/trainer-teams';
import { eliteFourTeamSize } from '../../../../services/enemy-team-service/enemy-team-size';

@Component({
  selector: 'app-champion-battle-roulette',
  standalone: true,
  imports: [
    ImgFallbackDirective,
    WheelComponent,
    TranslatePipe,
    EnemyTeamPanelComponent
],
  templateUrl: './champion-battle-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './champion-battle-roulette.component.css'
})
export class ChampionBattleRouletteComponent implements OnInit, OnDestroy {

  championByGeneration = championByGeneration;

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

  @ViewChild('championPresentationModal', { static: true }) championPresentationModal!: TemplateRef<any>;
  @ViewChild('itemUsedModal', { static: true }) itemUsedModal!: TemplateRef<any>;

  generation!: GenerationItem;
  trainerTeam!: PokemonItem[];
  trainerItems!: ItemItem[];
  @Input() currentRound!: number;
  @Output() battleResultEvent = new EventEmitter<boolean>();

  victoryOdds: WheelItem[] = [
    { text: 'Yes', fillStyle: 'green', weight: 1 },
    { text: 'No', fillStyle: 'crimson', weight: 1 }
  ];

  champion!: GymLeader;
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

      if (state === 'champion-battle') {
        this.champion = this.getChampion();
        this.buildEnemyTeam();
        this.calcVictoryOdds();

        this.modalService.open(this.championPresentationModal, {
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

  onItemSelected(index: number): void {
    this.retries--;
    if (this.victoryOdds[index].text === 'Yes') {
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

  /** Builds the opponent's squad and scores it against the player's team. */
  private buildEnemyTeam(): void {
    if (!this.isTypeAdvantageMode || !this.generation) {
      this.enemyTeam = [];
      this.typeAdvantage = null;
      return;
    }

    const theme = championTypesByGeneration[this.generation.id] ?? [];
    const roster = championTeamsByGeneration[this.generation.id] ?? [];

    this.enemyTeam = this.enemyTeamService.buildTeam(
      roster,
      this.generation.id,
      theme,
      eliteFourTeamSize(),
      `champion:${this.generation.id}`,
      { fullyEvolved: true, aceId: championAceByGeneration[this.generation.id] ?? 0 }
    );

    this.typeAdvantage = this.enemyTeamService.scoreAdvantage(this.trainerTeam ?? [], this.enemyTeam);
  }


  private getChampion(): GymLeader {
    let currentChampion = this.championByGeneration[this.generation.id][0];

    if (this.generation.id === 7) {

       const leaderNames = currentChampion.name.split('/');
       const leaderSprites = currentChampion.sprite;
       const leaderQuotes = currentChampion.quotes;
       const randomIndex = Math.floor(Math.random() * leaderNames.length);

       currentChampion = {
         name: leaderNames[randomIndex],
         sprite: leaderSprites[randomIndex],
         quotes: [leaderQuotes[randomIndex]]
       }
     }

     return currentChampion;
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
