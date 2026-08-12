import { Component, EventEmitter, OnDestroy, OnInit, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GenerationRouletteComponent } from "./roulettes/generation-roulette/generation-roulette.component";
import { ModeSelectComponent } from "./roulettes/mode-select/mode-select.component";
import { RunService, STARTING_LIVES } from '../../services/run-service/run.service';
import { GameStateService } from '../../services/game-state-service/game-state.service';
import { GameState } from '../../services/game-state-service/game-state';
import { EventSource } from '../EventSource';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TrainerService } from '../../services/trainer-service/trainer.service';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { ItemsService } from '../../services/items-service/items.service';
import { EvolutionService } from '../../services/evolution-service/evolution.service';
import { MegaEvolutionService } from '../../services/mega-evolution-service/mega-evolution.service';

import { AudioService } from '../../services/audio-service/audio.service';
import { SettingsService } from '../../services/settings-service/settings.service';
import { RareCandyService } from '../../services/rare-candy-service/rare-candy.service';
import { GenerationService } from '../../services/generation-service/generation.service';
import { battleTrainerByGeneration, roadblockByGeneration } from "../../data/generation-encounters";
import { Subscription } from 'rxjs';
import { CharacterSelectComponent } from "./roulettes/character-select/character-select.component";
import { StarterRouletteComponent } from "./roulettes/starter-roulette/starter-roulette.component";
import { PokemonItem } from '../../interfaces/pokemon-item';
import { ItemItem } from '../../interfaces/item-item';
import { ShinyRouletteComponent } from "./roulettes/shiny-roulette/shiny-roulette.component";
import { StartAdventureRouletteComponent } from "./roulettes/start-adventure-roulette/start-adventure-roulette.component";
import { ItemName } from '../../services/items-service/item-names';
import { PokemonFromGenerationRouletteComponent } from "./roulettes/pokemon-from-generation-roulette/pokemon-from-generation-roulette.component";
import { PokemonFromAuxListRouletteComponent } from "./roulettes/pokemon-from-aux-list-roulette/pokemon-from-aux-list-roulette.component";
import { MegaEvolutionRouletteComponent } from "./roulettes/mega-evolution-roulette/mega-evolution-roulette.component";
import { GymBattleRouletteComponent } from "./roulettes/gym-battle-roulette/gym-battle-roulette.component";
import { CheckEvolutionRouletteComponent } from "./roulettes/check-evolution-roulette/check-evolution-roulette.component";
import { MainAdventureRouletteComponent } from "./roulettes/main-adventure-roulette/main-adventure-roulette.component";
import { TeamRocketRouletteComponent } from "./roulettes/team-rocket-roulette/team-rocket-roulette.component";
import { VillainBossRouletteComponent } from "./roulettes/villain-boss-roulette/villain-boss-roulette.component";
import { MysteriousEggRouletteComponent } from "./roulettes/mysterious-egg-roulette/mysterious-egg-roulette.component";
import { LegendaryRouletteComponent } from "./roulettes/legendary-roulette/legendary-roulette.component";
import { BossLegendaryRouletteComponent } from "./roulettes/boss-legendary-roulette/boss-legendary-roulette.component";
import { BossLegendaryOutcomeRouletteComponent } from "./roulettes/boss-legendary-outcome-roulette/boss-legendary-outcome-roulette.component";
import { CatchLegendaryRouletteComponent } from "./roulettes/catch-legendary-roulette/catch-legendary-roulette.component";
import { TradePokemonRouletteComponent } from "./roulettes/trade-pokemon-roulette/trade-pokemon-roulette.component";
import { FindItemRouletteComponent } from "./roulettes/find-item-roulette/find-item-roulette.component";
import { ExploreCaveRouletteComponent } from "./roulettes/explore-cave-roulette/explore-cave-roulette.component";
import { CavePokemonRouletteComponent } from "./roulettes/cave-pokemon-roulette/cave-pokemon-roulette.component";
import { FossilRouletteComponent } from "./roulettes/fossil-roulette/fossil-roulette.component";
import { SnorlaxRouletteComponent } from "./roulettes/snorlax-roulette/snorlax-roulette.component";
import { FishingRouletteComponent } from "./roulettes/fishing-roulette/fishing-roulette.component";
import { RivalBattleRouletteComponent } from "./roulettes/rival-battle-roulette/rival-battle-roulette.component";
import { TrainerBattleRouletteComponent } from "./roulettes/trainer-battle-roulette/trainer-battle-roulette.component";
import { EliteFourPrepRouletteComponent } from "./roulettes/elite-four-prep-roulette/elite-four-prep-roulette.component";
import { EliteFourBattleRouletteComponent } from "./roulettes/elite-four-battle-roulette/elite-four-battle-roulette.component";
import { ChampionBattleRouletteComponent } from "./roulettes/champion-battle-roulette/champion-battle-roulette.component";
import { TournamentOfferComponent } from "./roulettes/tournament-offer/tournament-offer.component";
import { TournamentPrepRouletteComponent } from "./roulettes/tournament-prep-roulette/tournament-prep-roulette.component";
import { TournamentDrawRouletteComponent } from "./roulettes/tournament-draw-roulette/tournament-draw-roulette.component";
import { TournamentBattleRouletteComponent } from "./roulettes/tournament-battle-roulette/tournament-battle-roulette.component";
import { TournamentKind, TournamentService } from "../../services/tournament-service/tournament.service";
import { VillainTeamService } from "../../services/villain-team-service/villain-team.service";
import { EndGameComponent } from "../end-game/end-game.component";
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';
import { GameOverComponent } from "../game-over/game-over.component";

/** 0-based index of the 8th gym, where an abandoned Elite Four run resumes. */
const LAST_GYM_INDEX = 7;

@Component({
  selector: 'app-roulette-container',
  imports: [
    ImgFallbackDirective,
    TranslatePipe,
    GenerationRouletteComponent,
    ModeSelectComponent,
    CharacterSelectComponent,
    StarterRouletteComponent,
    ShinyRouletteComponent,
    StartAdventureRouletteComponent,
    PokemonFromGenerationRouletteComponent,
    PokemonFromAuxListRouletteComponent,
    MegaEvolutionRouletteComponent,
    GymBattleRouletteComponent,
    CheckEvolutionRouletteComponent,
    MainAdventureRouletteComponent,
    TeamRocketRouletteComponent,
    VillainBossRouletteComponent,
    MysteriousEggRouletteComponent,
    LegendaryRouletteComponent,
    BossLegendaryRouletteComponent,
    BossLegendaryOutcomeRouletteComponent,
    CatchLegendaryRouletteComponent,
    TradePokemonRouletteComponent,
    FindItemRouletteComponent,
    ExploreCaveRouletteComponent,
    CavePokemonRouletteComponent,
    FossilRouletteComponent,
    SnorlaxRouletteComponent,
    FishingRouletteComponent,
    RivalBattleRouletteComponent,
    TrainerBattleRouletteComponent,
    EliteFourPrepRouletteComponent,
    EliteFourBattleRouletteComponent,
    ChampionBattleRouletteComponent,
    TournamentOfferComponent,
    TournamentPrepRouletteComponent,
    TournamentDrawRouletteComponent,
    TournamentBattleRouletteComponent,
    EndGameComponent,
    GameOverComponent
],
  templateUrl: './roulette-container.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './roulette-container.component.css'
})
export class RouletteContainerComponent implements OnInit, OnDestroy {

    NINCADA_ID = 290;
    @Output() resetGameEvent = new EventEmitter<void>();

    private rareCandySubscription?: Subscription;

    constructor(
      private evolutionService: EvolutionService,
      private gameStateService: GameStateService,
      private itemService: ItemsService,
      private pokemonService: PokemonService,
      private generationService: GenerationService,
      private trainerService: TrainerService,
      private modalService: NgbModal,
      private audioService: AudioService,
      private settingsService: SettingsService,
      private rareCandyService: RareCandyService,
      private translate: TranslateService,
      private runService: RunService,
      private tournamentService: TournamentService,
      private megaEvolutionService: MegaEvolutionService,
      private villainTeamService: VillainTeamService) {
      this.itemFoundAudio = this.audioService.createAudio('./ItemFound.mp3');
    }

    ngOnInit(): void {
      this.gameStateService.currentState.subscribe(state => {
        this.currentGameState = state;
        if (this.currentGameState === 'adventure-continues') {
          if (this.multitaskCounter > 0) {
            this.respinReason = 'Multitask x' + this.multitaskCounter;
            this.multitaskCounter--;
          }
          if (this.runningShoesUsed) {
            this.respinReason = '(Running Shoes)';
          }
        }
      });

    this.gameStateService.currentRoundObserver.subscribe(round => {
      this.leadersDefeatedAmount = round;
    });

    // Which species have a Mega form at all — one cached local lookup, used to skip the
    // Mega wheel outright when it would have nothing to show.
    this.megaEvolutionService.megaCapableSpeciesIds().subscribe((ids) => {
      this.megaCapableIds = ids;
    });

    // Kept for the tournament bracket, which shows the player alongside their opponents.
    this.trainerService.getTrainer().subscribe(trainer => {
      this.playerSprite = trainer?.sprite ?? '';
    });

    this.gameStateService.wheelSpinningObserver.subscribe(state => {
      this.wheelSpinning = state;
    });

    // Subscribe to rare candy evolution trigger
    this.rareCandySubscription = this.rareCandyService.rareCandyTrigger$.subscribe((rareCandy) => {
      this.handleRareCandyEvolution(rareCandy);
    });
  }

  ngOnDestroy(): void {
    this.rareCandySubscription?.unsubscribe();
  }

  handleRareCandyEvolution(rareCandy: ItemItem): void {
    const pokemonThatCanEvolve = this.trainerService.getPokemonThatCanEvolve();

    if (pokemonThatCanEvolve.length > 0) {
      this.gameStateService.repeatCurrentState();
      this.trainerService.removeItem(rareCandy);
      this.chooseWhoWillEvolve('rare-candy');
    }
  }

  @ViewChild('altPrizeModal', { static: true }) altPrizeModal!: TemplateRef<any>;
  @ViewChild('infoModal', { static: true }) infoModal!: TemplateRef<any>;
  @ViewChild('itemActivateModal', { static: true }) itemActivateModal!: TemplateRef<any>;
  @ViewChild('pkmnEvoModal', { static: true }) pkmnEvoModal!: TemplateRef<any>;
  @ViewChild('pkmnTradeModal', { static: true }) pkmnTradeModal!: TemplateRef<any>;
  @ViewChild('teamRocketFailsModal', { static: true }) teamRocketFailsModal!: TemplateRef<any>;

  altPrizeDescription = '';
  altPrizeSprite = '';
  altPrizeText = '';
  auxPokemonList: PokemonItem[] = [];
  currentContextItem!: ItemItem;
  currentContextPokemon!: PokemonItem;
  currentGameState!: GameState;
  customWheelTitle = '';
  evolutionCredits: number = 0;
  expSharePokemon: PokemonItem | null = null;
  expShareUsed: boolean = false;
  fromLeader: number = 0;
  infoModalMessage = '';
  infoModalTitle = '';
  itemFoundAudio!: HTMLAudioElement;
  leadersDefeatedAmount: number = 0;
  multitaskCounter: number = 0;
  pkmnEvoTitle = '';
  pkmnIn!: PokemonItem;
  pkmnOut!: PokemonItem;
  pkmnTradeTitle = '';
  respinReason = '';
  runningShoesUsed: boolean = false;
  stolenPokemon!: PokemonItem | null;
  wheelSpinning: boolean = false;

  getGameState(): string {
    return this.currentGameState;
  }

  private finishCurrentState(): void {

    this.gameStateService.finishCurrentState();
    this.skipMegaWhenNobodyCan();

    if (this.currentGameState === 'adventure-continues') {
      if (this.trainerService.hasItem('running-shoes') && !this.runningShoesUsed) {
        this.runningShoesUsed = true;
        this.gameStateService.setNextState('adventure-continues');
      }
    }
  }

  handleGenerationSelected(): void {
    this.finishCurrentState();
  }

  handleModeSelected(): void {
    this.finishCurrentState();
  }

  /**
   * Hidden entirely in Classic, before a mode has been picked, and throughout a tournament
   * — a tournament entrant has no lives at all, so showing hearts there would be a lie.
   */
  get showLives(): boolean {
    if (!this.runService.isTypeAdvantageMode) return false;
    if (this.currentGameState === 'mode-select') return false;
    return !this.currentGameState?.startsWith('tournament-');
  }

  /** One entry per life; true means that heart has been spent. */
  get lifeSlots(): boolean[] {
    const remaining = this.runService.lives;
    return Array.from({ length: STARTING_LIVES }, (_, i) => i >= remaining);
  }

  /**
   * Spends a life on a lost battle.
   *
   * @returns true when the run survives and the caller should route the retry itself,
   *          false when the run is over and 'game-over' has already been queued.
   */
  private spendLife(): boolean {
    if (!this.runService.isTypeAdvantageMode) {
      this.gameStateService.setNextState('game-over');
      return false;
    }

    if (this.runService.loseLife()) return true;

    this.gameStateService.setNextState('game-over');
    return false;
  }

  handleTrainerSelected(): void {
    this.finishCurrentState();
  }

  storePokemon(pokemon: PokemonItem): void {
    this.trainerService.addToTeam(pokemon);
    this.gameStateService.setNextState('check-shininess');
    this.finishCurrentState();
  }

  setShininess(shiny: boolean): void {
    if (shiny) {
      this.trainerService.makeShiny();
    }
    this.finishCurrentState();
  }

  catchPokemon(): void {
    this.gameStateService.setNextState('catch-pokemon');
    this.finishCurrentState();
  }

  async chooseWhoWillEvolve(eventSource: EventSource): Promise<void> {
    this.auxPokemonList = [];
    this.auxPokemonList = this.trainerService.getPokemonThatCanEvolve();

    if (this.auxPokemonList.length === 0) {
      // ORIGINAL BEHAVIOR: if nobody can evolve, award a generation-appropriate
      // alternative reward (potion / egg / item) depending on what triggered the check.
      switch (eventSource) {
        // A trainer win is settled the same way a gym win is: nobody left to evolve means a
        // Potion instead, graded by how far the run has got. Without this branch, beating a
        // trainer with a fully evolved team paid nothing at all — the reward the encounter
        // exists to give was silently skipped by the teams most likely to have earned it.
        case 'battle-trainer':
        case 'gym-battle':
          this.altPrizeText = 'Got a Bonus Potion!';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png';
          this.altPrizeDescription = 'Since no evolution was possible, get the best Potion your money can buy!';
          this.modalService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          this.buyPotions();
          return;

                case 'legendary-boss':
          // If you beat the Legendary but nobody can evolve (common after villain boss),
          // give a fixed Hyper Potion so the run can continue.
          this.altPrizeText = 'Got a Hyper Potion!';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hyper-potion.png';
          this.altPrizeDescription = 'Since no evolution was possible, you received a Hyper Potion!';
          this.modalService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          this.trainerService.addToItems(this.itemService.getItem('hyper-potion'));
          this.playItemFoundAudio();
          this.finishCurrentState();
          return;

case 'visit-daycare':
          this.altPrizeText = 'Got a Mysterious Egg!';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/mystery-egg.png';
          this.altPrizeDescription = 'The people from the Day Care gave you a Mysterious Egg!';
          this.modalService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          this.mysteriousEgg();
          return;

        case 'battle-rival':
          this.altPrizeText = 'Got an Item!';
          this.altPrizeSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/refs/heads/master/sprites/items/unknown.png';
          this.altPrizeDescription = 'Your Rival said you only won by luck and gave you an Item!';
          this.modalService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          this.findItem();
          return;

        case 'snorlax-encounter':
          // New behavior: if you defeat the Roadblock Pokémon but nobody can evolve,
          // you find a pair of Running Shoes.
          this.altPrizeText = 'Got Running Shoes!';
          this.altPrizeSprite = './items/running-shoes.png';
          this.altPrizeDescription = 'altPrize.runningShoesRoadblock';
          this.modalService.open(this.altPrizeModal, {
            centered: true,
            size: 'md'
          });
          this.trainerService.addToItems(this.itemService.getItem('running-shoes'));
          this.playItemFoundAudio();
          this.finishCurrentState();
          return;

        case 'rare-candy':
        // If a Battle Trainer encounter triggers an evolution check and nothing can evolve,
        // we just continue. (Rewards already happened in the battle itself.)
        case 'battle-trainer':
        default:
          this.doNothing();
          return;
      }
    }

    if (this.auxPokemonList.length === 1) {
      this.evolvePokemon(this.auxPokemonList[0]);
      return;
    }

    this.customWheelTitle = 'game.main.roulette.evolve.who';
    this.gameStateService.setNextState('evolve-pokemon');
    this.gameStateService.setNextState('select-from-pokemon-list');
    this.finishCurrentState();
  }

  private async showBattleTrainerEncounter(): Promise<void> {
    try {
      const genId = this.generationService.getCurrentGeneration().id;
      const options = battleTrainerByGeneration[genId] || [];

      if (!options || options.length === 0) return;

      const encounter = options[Math.floor(Math.random() * options.length)];

      this.altPrizeText = `Trainer Battle: ${encounter.name}`;
      this.altPrizeSprite = encounter.spriteUrl;
      this.altPrizeDescription = encounter.blurb;

      await this.modalService
        .open(this.altPrizeModal, { centered: true, size: 'lg' })
        .result.catch(() => {});
    } catch {
      // Never block gameplay if a modal fails.
      return;
    }
  }

  buyPotions(): void {
    let itemName: ItemName = 'potion';

    if (this.leadersDefeatedAmount > 6) {
      itemName = 'hyper-potion';
    } else if (this.leadersDefeatedAmount > 3) {
      itemName = 'super-potion';
    }

    this.trainerService.addToItems(this.itemService.getItem(itemName));
    this.playItemFoundAudio();
    this.finishCurrentState();
  }

  doNothing(): void {
    this.finishCurrentState();
  }

  mysteriousEgg(): void {
    this.gameStateService.setNextState('mysterious-egg');
    this.finishCurrentState();
  }

  findItem(): void {
    this.gameStateService.setNextState('find-item');
    this.finishCurrentState();
  }

  continueWithPokemon(pokemon: PokemonItem): void {
    this.finishCurrentState();
    switch (this.currentGameState) {
      case 'evolve-pokemon':
        this.evolvePokemon(pokemon);
        break;
      case 'select-evolution':
        this.replaceForEvolution(this.currentContextPokemon, pokemon);
        this.showpkmnEvoModal();
        break;
      case 'steal-pokemon':
        this.stolenPokemon = pokemon;
        // Filed against whoever is actually in front of you. With rival teams the run has
        // to know which of them is holding it, or beating one hands back the other's haul.
        {
          const thief = this.villainTeamService.currentTeam;
          if (thief) this.villainTeamService.steal(thief.id, pokemon);
        }
        this.removeFromTeam(pokemon);
        this.finishCurrentState();
        break;
      case 'trade-pokemon':
        this.currentContextPokemon = pokemon;
        break;
      default:
        break;
    }
  }

  megaEvolutionFinished(): void {
    this.finishCurrentState();
  }

  /**
   * Steps straight past the Mega state when nobody on the team has a Mega form.
   *
   * The component used to handle this itself by reporting "nothing to do" as soon as it
   * loaded, but that answer now comes from local data and can arrive *inside* the same
   * change detection pass that just rendered it — leaving an empty wheel under a "Mega
   * Evolution" heading on screen even though the run had already moved on. Deciding here,
   * before the state is ever shown, removes the race entirely: the screen is never
   * rendered in the first place.
   */
  private skipMegaWhenNobodyCan(): void {
    // Bounded: consecutive Mega states are only ever queued a few deep.
    for (let guard = 0; guard < 8; guard++) {
      if (this.currentGameState !== 'mega-evolution') return;
      if (!this.megaCapableIds) return; // capability list not loaded yet — let it render
      if (this.teamHasAMegaCandidate()) return;

      this.gameStateService.finishCurrentState();
    }
  }

  private teamHasAMegaCandidate(): boolean {
    const capable = this.megaCapableIds;
    if (!capable) return true;

    return (this.trainerService.getTeam() ?? []).some((p) =>
      capable.has(p.basePokemonId ?? p.pokemonId)
    );
  }

  secondEvolution(): void {
    this.auxPokemonList = [];

    this.auxPokemonList = this.trainerService.getPokemonThatCanEvolve();

    if (this.expSharePokemon) {
      const index = this.auxPokemonList.indexOf(this.expSharePokemon);
      if (index > -1) {
        this.auxPokemonList.splice(index, 1);
      }
    }

    if (this.auxPokemonList.length === 0) {
      return;
    }

    if (this.auxPokemonList.length === 1) {
      return this.evolveSecondPokemon(this.auxPokemonList[0]);
    }

    this.customWheelTitle = 'Who will evolve (Exp. Share)?';
    this.gameStateService.setNextState('evolve-pokemon');
    this.gameStateService.setNextState('select-from-pokemon-list');
  }

  gymBattleResult(result: boolean): void {
    // Mega Evolution is battle-only (it should revert right after each battle).
    this.megaEvolutionService.revertMegaEvolution();

    this.runningShoesUsed = false;
    this.respinReason = '';

    if (result) {
      this.playItemFoundAudio();
      // Only Gym Battles should award gym badges.
      // (This guard prevents badges being granted if this handler is ever called
      // from a non-gym context.)
      if (this.currentGameState === 'gym-battle') {
        this.trainerService.addBadge(this.leadersDefeatedAmount, this.fromLeader);
      }
      this.gameStateService.setNextState('check-evolution');

    } else if (this.spendLife()) {
      // A life buys another run-up: the pre-gym wheel, then the same leader again.
      this.gameStateService.retryCurrentGym();
      this.respinReason = this.translate.instant('game.main.roulette.lives.gymRetry');

      // finishCurrentState() bumps the round on the way out of a battle, so undo it
      // afterwards — otherwise the retry lands on the NEXT leader and the badge is lost.
      this.finishCurrentState();
      this.gameStateService.rewindRound();
      return;
    }

    this.finishCurrentState();
  }

  catchTwoPokemon(): void {
    this.gameStateService.setNextState('catch-pokemon');
    this.gameStateService.setNextState('catch-pokemon');
    this.finishCurrentState();
  }

  teamRocketEncounter(): void {
    this.gameStateService.setNextState('team-rocket-encounter');
    this.finishCurrentState();
  }

  /**
   * Post-8th-gym boss encounter.
   * If you defeat the villain team, you evolve once and then face the region's main legendary.
   */
  villainBossDefeated(): void {
    this.runService.markVillainBossCleared();
    this.runService.markLegendaryOffered();

    // Clearing the region's boss releases everything any of its teams still holds. This is
    // what stops a Pokémon being lost for good: a Hoenn run can lose one to Aqua and then
    // never draw Aqua again, so without an amnesty here it would simply be gone.
    const genId = this.generationService.getCurrentGeneration().id;
    const freed = this.villainTeamService.recoverForGeneration(genId);

    for (const pokemon of freed) {
      this.trainerService.addToTeam(pokemon);
    }

    if (freed.length) {
      const names = freed.map((p) => this.translate.instant(p.text)).join(', ');
      this.infoModalTitle = 'Rescued ' + names + '!';
      this.infoModalMessage = 'With the boss beaten, everything they were holding is yours again.';
      this.stolenPokemon = null;
      this.modalService.open(this.infoModal, { centered: true, size: 'md' });
    }

    // Queue the legendary boss encounter AFTER the evolution roulette.
    this.gameStateService.setNextState('boss-legendary-encounter');
    this.chooseWhoWillEvolve('villain-boss');
  }

  /**
   * Losing the villain boss costs a life AND a Pokémon, and the fight is not over: the
   * player is sent back one roulette and has to face the boss again. Losing again costs
   * another life and another Pokémon, so the encounter can be attempted until the run
   * either wins it or runs out of lives.
   */
  villainBossLost(): void {
    // Classic keeps the original outcome: they take a Pokémon and the run moves on to the
    // Elite Four. Only Type Advantage spends a life and makes you face the boss again.
    if (!this.runService.isTypeAdvantageMode) {
      this.stealPokemon();
      return;
    }

    if (!this.runService.loseLife()) {
      this.gameStateService.setNextState('game-over');
      this.finishCurrentState();
      return;
    }

    // Queued in reverse pop order: adventure wheel -> Mega chance -> the boss again.
    this.gameStateService.setNextState('villain-boss-encounter');
    this.gameStateService.setNextState('mega-evolution');
    this.gameStateService.setNextState('adventure-continues');
    this.respinReason = this.translate.instant('game.main.roulette.lives.villainRetry');

    this.stealPokemon();
  }

  villainBossRetreated(): void {
    // No special rewards — proceed to Elite Four preparation.
    this.doNothing();
  }

  legendaryEncounter(): void {
    this.gameStateService.setNextState('legendary-encounter');
    this.finishCurrentState();
  }

  bossLegendaryChosen(pokemon: PokemonItem): void {
    this.currentContextPokemon = pokemon;
    this.gameStateService.setNextState('boss-legendary-outcome');
    this.finishCurrentState();
  }

  bossLegendaryDefeated(): void {
    // Defeating the legendary gives one more evolution.
    this.chooseWhoWillEvolve('legendary-boss');
  }

  bossLegendaryCaptured(): void {
    this.gameStateService.setNextState('check-shininess');
    this.trainerService.addToTeam(this.currentContextPokemon);
    this.finishCurrentState();
  }

  tradePokemon(): void {
    this.gameStateService.setNextState('trade-pokemon');

    const trainerTeam = this.trainerService.getTeam();

    if (trainerTeam.length === 1) {
      this.currentContextPokemon = trainerTeam[0];
    } else {
      this.auxPokemonList = trainerTeam;
      this.customWheelTitle = 'Which Pokémon?';
      this.gameStateService.setNextState('select-from-pokemon-list');
    }

    this.finishCurrentState();
  }

  exploreCave(): void {
    this.gameStateService.setNextState('explore-cave');
    this.finishCurrentState();
  }

  snorlaxEncounter(): void {
    this.gameStateService.setNextState('snorlax-encounter');
    this.finishCurrentState();
  }

  multitask(): void {
    this.gameStateService.setNextState('adventure-continues');
    this.gameStateService.setNextState('adventure-continues');
    this.multitaskCounter = this.multitaskCounter + 2;
    this.respinReason = 'Multitask x' + this.multitaskCounter;
    this.finishCurrentState();
  }

  goFishing(): void {
    this.gameStateService.setNextState('go-fishing');
    this.finishCurrentState();
  }

  findFossil(): void {
    this.gameStateService.setNextState('find-fossil');
    this.finishCurrentState();
  }

  battleRival(): void {
    this.gameStateService.setNextState('battle-rival');
    // Mega Evolution roulette should happen before any battle.
    this.gameStateService.setNextState('mega-evolution');
    this.finishCurrentState();
  }

  /** The roadside trainer encounter is a real battle now, not a shortcut to evolving. */
  battleTrainer(): void {
    this.gameStateService.setNextState('trainer-battle');
    this.finishCurrentState();
  }

  trainerBattleResult(result: boolean): void {
    // Mega Evolution is battle-only (it should revert right after each battle).
    this.megaEvolutionService.revertMegaEvolution();

    if (result) {
      // Winning still grants the evolution this encounter has always awarded.
      this.chooseWhoWillEvolve('battle-trainer');
      return;
    }

    // Classic has no lives: losing simply forfeits the evolution and the run continues.
    if (!this.runService.isTypeAdvantageMode) {
      this.doNothing();
      return;
    }

    if (this.spendLife()) {
      this.gameStateService.setNextState('adventure-continues');
      this.respinReason = this.translate.instant('game.main.roulette.lives.rivalRetry');
    }

    this.finishCurrentState();
  }

  rivalBattleResult(result: boolean): void {
    // Mega Evolution is battle-only (it should revert right after each battle).
    this.megaEvolutionService.revertMegaEvolution();

    if (result) {
      this.chooseWhoWillEvolve('battle-rival');
      return;
    }

    // Classic has no lives, and a lost rival battle has always just moved the run along.
    if (!this.runService.isTypeAdvantageMode) {
      this.doNothing();
      return;
    }

    // Losing a rival battle costs a life like any other battle, and sends the player back
    // one roulette. No Pokémon is taken — only the villain team steals.
    if (this.spendLife()) {
      this.gameStateService.setNextState('adventure-continues');
      this.respinReason = this.translate.instant('game.main.roulette.lives.rivalRetry');
    }

    this.finishCurrentState();
  }

  stealPokemon(): void {
    const trainerTeam = this.trainerService.getTeam();

    if (trainerTeam.length === 1) {
      const modalRef = this.modalService.open(this.teamRocketFailsModal, {
        centered: true,
        size: 'md'
      });

      modalRef.result.then(() => {
        return this.doNothing();
      }, () => {
        return this.doNothing();
      });
    } else if (this.trainerService.hasItem('escape-rope')) {
      this.useEscapeRope();
    } else {
      this.auxPokemonList = trainerTeam;
      this.customWheelTitle = 'Which Pokémon?';
      this.gameStateService.setNextState('steal-pokemon');
      this.gameStateService.setNextState('select-from-pokemon-list');
      this.finishCurrentState();
    }
  }

  teamRocketDefeated(): void {
    const team = this.villainTeamService.currentTeam;
    const recovered = team ? this.villainTeamService.recoverFrom(team.id) : [];

    for (const pokemon of recovered) {
      this.trainerService.addToTeam(pokemon);
    }

    if (recovered.length) {
      const names = recovered.map((p) => this.translate.instant(p.text)).join(', ');
      this.infoModalTitle = 'Saved ' + names + '!';
      this.infoModalMessage =
        'You recovered ' + names + ' from ' + (team?.name ?? 'them') + '.';
      this.stolenPokemon = null;
      this.modalService.open(this.infoModal, { centered: true, size: 'md' });
    }

    this.chooseWhoWillEvolve('team-rocket-encounter');
  }

  legendaryCaptureChance(pokemon: PokemonItem): void {
    this.currentContextPokemon = pokemon;
    this.gameStateService.setNextState('catch-legendary');
    this.finishCurrentState();
  }
  
  legendaryCaptureSuccess(): void {
    this.gameStateService.setNextState('check-shininess');
    this.trainerService.addToTeam(this.currentContextPokemon);
    this.finishCurrentState();
  }

  performTrade(pokemon: PokemonItem): void {
    this.pkmnIn = structuredClone(pokemon);;
    this.pkmnOut = this.currentContextPokemon;
    this.pkmnTradeTitle = "Trade!";
    this.trainerService.performTrade(this.currentContextPokemon, this.pkmnIn);
    this.auxPokemonList = [];
    this.playItemFoundAudio();
    if (!this.settingsService.currentSettings.lessExplanations) {
      const modalRef = this.modalService.open(this.pkmnTradeModal, {
        centered: true,
        size: 'md'
      });

      modalRef.result.then(() => {
        this.finishCurrentState();
      }, () => {
        this.finishCurrentState();
      });
    } else {
      this.finishCurrentState();
    }
  }

  receiveItem(item: ItemItem): void {
    this.trainerService.addToItems(item);
    this.finishCurrentState();
  }

  catchCavePokemon(): void {
    this.gameStateService.setNextState('catch-cave-pokemon');
    this.finishCurrentState();
  }

  getLost(): void {
    if (this.trainerService.hasItem('escape-rope')) {
      this.useEscapeRope();
    } else {
      return this.doNothing();
    }
  }

  catchZubat(): void {
    const zubat = this.pokemonService.getPokemonById(41);
    if (zubat) {
      this.trainerService.addToTeam(zubat);
      this.gameStateService.setNextState('check-shininess');
    }
    this.finishCurrentState();
  }

  catchSnorlax(): void {
    const genId = this.generationService.getCurrentGeneration().id;
    const roadblock = roadblockByGeneration[genId] || roadblockByGeneration[1];

    const pkmn = this.pokemonService.getPokemonById(roadblock.pokemonId);
    if (pkmn) {
      this.trainerService.addToTeam(pkmn);
      this.gameStateService.setNextState('check-shininess');
    }

    this.finishCurrentState();
  }

  eliteFourBattleResult(result: boolean): void {
    // Mega Evolution is battle-only (it should revert right after each battle).
    this.megaEvolutionService.revertMegaEvolution();

    this.runningShoesUsed = false;
    this.respinReason = '';

    if (result) {
      this.gameStateService.setNextState('check-evolution');
    } else if (this.spendLife()) {
      this.leaveEliteFour();
      return;
    }
    this.finishCurrentState();
  }

  /**
   * Losing inside the Elite Four ends the challenge: the player walks back out and has to
   * clear the 8th gym again before returning. The villain boss and the legendary are not
   * replayed — both are one-off events for the run.
   */
  private leaveEliteFour(): void {
    this.gameStateService.restartEliteFourRun();
    this.respinReason = this.translate.instant('game.main.roulette.lives.eliteFourRetry');

    this.finishCurrentState();

    // The round counter keeps climbing through the Elite Four (8, 9, 10...). The run now
    // resumes at the 8th gym, so point it back there or the replayed gym would look up a
    // leader index that does not exist.
    this.gameStateService.setRound(LAST_GYM_INDEX);
  }

  championBattleResult(result: boolean): void {
    // Mega Evolution is battle-only (it should revert right after each battle).
    this.megaEvolutionService.revertMegaEvolution();

    this.runningShoesUsed = false;
    this.respinReason = '';

    if (!result && this.spendLife()) {
      this.leaveEliteFour();
      return;
    }

    // A Champion win leads into 'tournament-offer'; the regional invitation is the one on
    // the table until that tournament has actually been won.
    this.tournamentKind = 'regional';
    this.finishCurrentState();
  }

  // ------------------------------------------------------------ world tournament

  /** Which invitation the offer screen is currently showing. */
  tournamentKind: TournamentKind = 'regional';

  /** The player's own trainer sprite, used for their slot in the bracket. */
  private playerSprite = '';

  /** Null until the Mega form table has loaded. */
  private megaCapableIds: Set<number> | null = null;

  /**
   * Accepting an invitation opens the tournament and queues its run-up: the restricted
   * catch wheel, then the seeding draw.
   */
  tournamentAccepted(kind: TournamentKind): void {
    const genId = this.generationService.getCurrentGeneration().id;

    this.tournamentService.start(kind, genId, this.playerSprite, this.trainerService.gender);

    this.gameStateService.startTournament();
    this.finishCurrentState();
  }

  /** Declining drops straight through to the ending. */
  tournamentDeclined(): void {
    this.tournamentService.reset();
    this.finishCurrentState();
  }

  /** The draw is done — go straight into the first match. */
  tournamentDrawComplete(): void {
    this.gameStateService.queueTournamentBattle();
    this.finishCurrentState();
  }

  tournamentBattleResult(result: boolean): void {
    this.megaEvolutionService.revertMegaEvolution();
    this.respinReason = '';

    const wasGroups = this.tournamentService.stage === 'groups';
    this.tournamentService.reportPlayerResult(result);
    const stage = this.tournamentService.stage;

    // Losing ends the tournament outright — there are no lives here, and no returning to
    // an earlier wheel. The run resets from the game-over screen.
    if (stage === 'eliminated') {
      this.gameStateService.setNextState('game-over');
      this.finishCurrentState();
      return;
    }

    if (stage === 'won') {
      // Winning the regional title unlocks the World Tournament; winning the World
      // Tournament is the end of the line, so that one runs into the ending.
      if (this.tournamentService.kind === 'regional') {
        this.tournamentKind = 'world';
        this.gameStateService.setNextState('tournament-offer');
      }
      this.finishCurrentState();
      return;
    }

    // A won match earns the same evolution check every other battle in the game grants.
    // The tournament used to be the one place a win bought nothing: six fully evolved
    // opponents every round, and no way to grow between them. Queued before the next
    // match so the evolution is in hand for the fight it has to survive.
    if (result) {
      this.gameStateService.queueTournamentBattle();
      this.chooseWhoWillEvolve('tournament-battle');
      return;
    }

    // Clearing the group stage earns another catch wheel before the bracket.
    if (wasGroups && stage === 'knockout') {
      this.gameStateService.queueTournamentBattle();
      this.gameStateService.queueTournamentPrep();
      this.finishCurrentState();
      return;
    }

    this.gameStateService.queueTournamentBattle();
    this.finishCurrentState();
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  resetGameAction(): void {
    this.evolutionCredits = 0;
    // Otherwise the PC would still show the bracket of the tournament that just ended.
    this.tournamentService.reset();
    this.villainTeamService.reset();
    this.tournamentKind = 'regional';
    this.resetGameEvent.emit();
    this.modalService.dismissAll();
  }

  private evolvePokemon(pokemon: PokemonItem): void {
    const pokemonEvolutions = this.evolutionService.getEvolutions(pokemon);

    // Safety net: this should be prevented by EvolutionService.canEvolve(),
    // but if data ever marks a Pokémon as evolvable without actual evolutions,
    // we must not soft-lock the run.
    if (pokemonEvolutions.length === 0) {
      this.doNothing();
      return;
    }

    if (pokemonEvolutions.length === 1) {
      this.replaceForEvolution(pokemon, pokemonEvolutions[0]);
      this.showpkmnEvoModal();
    } else {
      this.auxPokemonList = pokemonEvolutions;
      this.currentContextPokemon = pokemon;
      this.customWheelTitle = 'Which evolution?';
      this.gameStateService.setNextState('select-evolution');
      this.gameStateService.setNextState('select-from-pokemon-list');
      this.finishCurrentState();
    }
  }

  private replaceForEvolution(pokemonOut: PokemonItem, pokemonIn: PokemonItem): void {
    this.pkmnOut = pokemonOut;
    this.pkmnIn = structuredClone(pokemonIn);
    this.pkmnEvoTitle = "game.main.roulette.evolve.modal.title"
    this.trainerService.replaceForEvolution(this.pkmnOut, this.pkmnIn);

    if (this.trainerService.hasItem('exp-share') && this.expShareUsed === false) {
      this.expShareUsed = true;
      this.expSharePokemon = this.pkmnIn;
      this.secondEvolution();
    } else if (this.trainerService.hasItem('exp-share') && this.expShareUsed === true) {
      this.expShareUsed = false;
      this.expSharePokemon = null;
    }
  }

  private evolveSecondPokemon(pokemon: PokemonItem): void {
    const pokemonEvolutions = this.evolutionService.getEvolutions(pokemon);

    // Safety net: never allow an empty evolution list to enter the selection roulette.
    if (pokemonEvolutions.length === 0) {
      this.doNothing();
      return;
    }

    if (pokemonEvolutions.length === 1) {
      this.replaceForEvolution(pokemon, pokemonEvolutions[0]);
    } else if (pokemon.pokemonId === this.NINCADA_ID) {
      this.replaceForEvolution(pokemon, pokemonEvolutions[0]);
      this.trainerService.addToTeam(pokemonEvolutions[1]);
    } else {
      this.auxPokemonList = pokemonEvolutions;
      this.currentContextPokemon = pokemon;
      this.customWheelTitle = 'Which evolution?';
      this.gameStateService.setNextState('select-evolution');
      this.gameStateService.setNextState('select-from-pokemon-list');
    }
  }

  private removeFromTeam(pokemon: PokemonItem): void {
    this.trainerService.removeFromTeam(pokemon);
    this.auxPokemonList = [];
  }

  private playItemFoundAudio(): void {
    this.audioService.playAudio(this.itemFoundAudio, 0.25);
  }

  private showpkmnEvoModal(): void {
    this.playItemFoundAudio();
    if (!this.settingsService.currentSettings.lessExplanations) {
      const modalRef = this.modalService.open(this.pkmnEvoModal, {
        centered: true,
        size: 'md'
      });

      modalRef.result.then(() => {
        this.finishCurrentState();
      }, () => {
        this.finishCurrentState();
      });
    } else {
      this.finishCurrentState();
    }
  }

  private useEscapeRope(): void {
    const item = this.trainerService.getItem('escape-rope');
    if (item) {
      this.trainerService.removeItem(item);
      this.currentContextItem = item;
      this.gameStateService.setNextState('adventure-continues');

      if (!this.settingsService.currentSettings.lessExplanations) {
        const modalRef = this.modalService.open(this.itemActivateModal, {
          centered: true,
          size: 'md'
        });

        modalRef.result.then(() => {
          this.finishCurrentState();
        }, () => {
          this.finishCurrentState();
        });
      } else {
        this.finishCurrentState();
      }
    }
  }
}
