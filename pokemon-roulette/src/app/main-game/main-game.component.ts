import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NgbCollapseModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TrainerTeamComponent } from "../trainer-team/trainer-team.component";
import { ItemsComponent } from "../items/items.component";
import { GameStateService } from '../services/game-state-service/game-state.service';
import { CommonModule } from '@angular/common';
import { ItemItem } from '../interfaces/item-item';
import { RestartGameButtonComponent } from "../restart-game-buttom/restart-game-buttom.component";
import { TrainerService } from '../services/trainer-service/trainer.service';
import { AnalyticsService } from '../services/analytics-service/analytics.service';
import { NgIconsModule } from '@ng-icons/core';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { Observable } from 'rxjs';
import { RouletteContainerComponent } from './roulette-container/roulette-container.component';
import { SettingsButtonComponent } from '../settings-button/settings-button.component';
import { RareCandyService } from '../services/rare-candy-service/rare-candy.service';
import { PokedexPanelComponent } from './pokedex-panel/pokedex-panel.component';
import { PokedexScreenComponent } from './pokedex-screen/pokedex-screen.component';
import { PokedexUiService } from '../services/pokedex-ui.service';

@Component({
  selector: 'app-main-game',
  imports: [
    CommonModule,
    RouletteContainerComponent,
    SettingsButtonComponent,
    TrainerTeamComponent,
    ItemsComponent,
    RestartGameButtonComponent,    NgIconsModule,
    NgbCollapseModule,    PokedexPanelComponent,
    PokedexScreenComponent
  ],
  templateUrl: './main-game.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './main-game.component.css'
})
export class MainGameComponent implements OnInit, OnDestroy {

  constructor(
    private darkModeService: DarkModeService,
    private gameStateService: GameStateService,
    private trainerService: TrainerService,
    private modalService: NgbModal,
    private analyticsService: AnalyticsService,
    private rareCandyService: RareCandyService,
    private pokedexUi: PokedexUiService) {
      this.darkMode = this.darkModeService.darkMode$;
      this.pokedexOpen$ = this.pokedexUi.isOpen$;
  }

  wheelSpinning: boolean = false;
  pokedexOpen$!: Observable<boolean>;
  isMobile: boolean = false;
  private _resizeHandler = () => this.updateIsMobile();

  ngOnInit(): void {
    this.updateIsMobile();
    try {
      window.addEventListener('resize', this._resizeHandler, { passive: true } as any);
    } catch {}

    this.analyticsService.trackEvent('main-game-loaded', 'Main Game Loaded', 'user acess');

    this.gameStateService.wheelSpinningObserver.subscribe(state => {
      this.wheelSpinning = state;
    });
  }

  ngOnDestroy(): void {
    try {
      window.removeEventListener('resize', this._resizeHandler as any);
    } catch {}
  }

  private updateIsMobile(): void {
    try {
      this.isMobile = window.matchMedia('(max-width: 575.98px)').matches;
    } catch {
      this.isMobile = false;
    }
  }
  
  darkMode!: Observable<boolean>;
  mapIsCollapsed: boolean = true;

  resetGameAction(): void {
    this.resetGame();
    this.modalService.dismissAll();
  }

  rareCandyInterrupt(rareCandy: ItemItem): void {
    if(this.wheelSpinning){
      return;
    }

    this.rareCandyService.triggerRareCandyEvolution(rareCandy);
  }

  resetGame(): void {
    this.trainerService.resetTrainer();
    this.trainerService.resetTeam();
    this.trainerService.resetItems();
    this.trainerService.resetBadges();
    this.gameStateService.resetGameState();
  }
}
