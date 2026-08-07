import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';

import { forkJoin, map, of, Subscription, switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { PokemonItem } from '../../../../interfaces/pokemon-item';
import {
  MegaEvolutionService,
  MegaForm,
} from '../../../../services/mega-evolution-service/mega-evolution.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { CryService } from '../../../../services/cry-service/cry.service';
import { SettingsService } from '../../../../services/settings-service/settings.service';

type MegaRouletteMode = 'select-pokemon' | 'select-mega-form';

/**
 * Length of the transformation, matching --mega-duration in the stylesheet.
 * Change one and change the other.
 */
const MEGA_ANIMATION_MS = 3200;

/** The white flash at 68% of the animation, where the two forms swap. */
const MEGA_FLASH_MS = Math.round(MEGA_ANIMATION_MS * 0.68);

/** A beat on the finished Mega before the popup closes. */
const MEGA_HOLD_MS = 600;

@Component({
  selector: 'app-mega-evolution-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './mega-evolution-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mega-evolution-roulette.component.css',
})
export class MegaEvolutionRouletteComponent implements OnInit, OnDestroy {
  @Output() megaEvolutionFinished = new EventEmitter<void>();

  @ViewChild('megaEvolutionModal', { static: true })
  megaEvolutionModal!: TemplateRef<any>;

  mode: MegaRouletteMode = 'select-pokemon';
  wheelTitle = 'Mega Evolution';

  isLoading = true;

  /** Candidates: team Pokémon that can Mega Evolve and their available Mega forms. */
  private megaCandidates: Array<{ pokemon: PokemonItem; megaForms: MegaForm[] }> = [];

  /** Current wheel items (either Pokémon or Mega forms). */
  wheelItems: any[] = [];

  /** When selecting a Mega form, this is the Pokémon chosen in the previous wheel. */
  private selectedPokemonForMega: PokemonItem | null = null;

  /** Selected Mega form (for cry + display). */
  private selectedMegaForm: MegaForm | null = null;

  /** Popup data */
  popupBeforeNameKey = '';
  popupAfterName = '';
  popupBeforeSpriteUrl = '';
  popupAfterSpriteUrl = '';

  /** Animation */
  isMegaAnimating = false;
  isCryPhase = false;

  private subs = new Subscription();
  private modalRef: NgbModalRef | null = null;

  constructor(
    private trainerService: TrainerService,
    private megaEvolutionService: MegaEvolutionService,
    private cryService: CryService,
    private settingsService: SettingsService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    const team = this.trainerService.getTeam();

    if (!team || team.length === 0) {
      this.isLoading = false;
      this.megaEvolutionFinished.emit();
      return;
    }

    // Answer "can anyone here Mega Evolve?" from local data before spending a request per
    // team member. When nobody can, the state ends immediately and the player never waits
    // on a wheel that was only ever going to be skipped.
    const sub = this.megaEvolutionService
      .megaCapableSpeciesIds()
      .pipe(
        switchMap((capable) => {
          const possible = team.filter((p) =>
            this.megaEvolutionService.canMegaEvolveLocally(p, capable)
          );

          if (possible.length === 0) return of([] as Array<{ pokemon: PokemonItem; megaForms: MegaForm[] }>);

          return forkJoin(
            possible.map((p) =>
              this.megaEvolutionService
                .getMegaFormsForPokemon(p)
                .pipe(map((forms) => ({ pokemon: p, megaForms: forms })))
            )
          );
        })
      )
      .subscribe({
        next: (results) => {
          this.megaCandidates = results.filter((r) => (r.megaForms?.length ?? 0) > 0);
          this.isLoading = false;

          if (this.megaCandidates.length === 0) {
            this.leaveWithoutMega();
            return;
          }

          this.mode = 'select-pokemon';
          this.wheelTitle = 'Mega Evolution';
          this.wheelItems = this.megaCandidates.map((c) => c.pokemon);
        },
        error: () => {
          this.isLoading = false;
          this.leaveWithoutMega();
        },
      });

    this.subs.add(sub);
  }

  /**
   * Leaves the Mega state when there is nothing to offer.
   *
   * The answer now comes from local data, which can resolve *synchronously* — inside the
   * container's own change detection pass. Emitting there advanced the game state but left
   * this component on screen: an empty wheel under a "Mega Evolution" heading that never
   * went away. Deferring by a microtask lets the current pass finish, so the container
   * re-renders normally.
   */
  private leaveWithoutMega(): void {
    void Promise.resolve().then(() => this.megaEvolutionFinished.emit());
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    try {
      this.modalRef?.close();
    } catch {
      // ignore
    }
  }

  onItemSelected(index: number): void {
    if (this.isLoading) return;

    if (this.mode === 'select-pokemon') {
      const candidate = this.megaCandidates[index];
      if (!candidate) {
        this.megaEvolutionFinished.emit();
        return;
      }

      this.selectedPokemonForMega = candidate.pokemon;

      if ((candidate.megaForms?.length ?? 0) <= 1) {
        this.applyMegaEvolution(candidate.pokemon, candidate.megaForms[0]);
        return;
      }

      this.mode = 'select-mega-form';
      this.wheelTitle = 'Mega Evolution';
      this.wheelItems = candidate.megaForms.map((f) => ({
        text: f.displayName,
        fillStyle: candidate.pokemon.fillStyle,
        weight: 1,
        _megaForm: f,
      }));
      return;
    }

    const selected = this.wheelItems[index] as any;
    const megaForm: MegaForm | undefined = selected?._megaForm;

    if (!this.selectedPokemonForMega || !megaForm) {
      this.megaEvolutionFinished.emit();
      return;
    }

    this.applyMegaEvolution(this.selectedPokemonForMega, megaForm);
  }

  private applyMegaEvolution(pokemon: PokemonItem, megaForm: MegaForm): void {
    // Snapshot BEFORE mutation
    this.popupBeforeNameKey = pokemon.text;
    this.popupBeforeSpriteUrl = pokemon.shiny
      ? pokemon.sprite?.front_shiny || pokemon.sprite?.front_default || ''
      : pokemon.sprite?.front_default || '';

    this.popupAfterName = megaForm.displayName;
    this.selectedMegaForm = megaForm;

    const sub = this.megaEvolutionService.megaEvolveForBattle(pokemon, megaForm).subscribe({
      next: () => {
        // After sprite (pokemon object already updated)
        this.popupAfterSpriteUrl = pokemon.shiny
          ? pokemon.sprite?.front_shiny || pokemon.sprite?.front_default || ''
          : pokemon.sprite?.front_default || '';

        this.openMegaPopupAndProceed();
      },
      error: () => {
        this.megaEvolutionFinished.emit();
      },
    });

    this.subs.add(sub);
  }

  private openMegaPopupAndProceed(): void {
    try {
      this.isMegaAnimating = true;
      this.isCryPhase = false;

      this.modalRef = this.modalService.open(this.megaEvolutionModal, {
        centered: true,
        backdrop: 'static',
        keyboard: false,
      });

      // The popup used to blink for a fixed 3 seconds and only *then* start hunting for the
      // cry, so the sound landed late and the window outstayed it. The cry is now resolved
      // and played while the blink runs, and the popup closes as soon as it ends.
      void this.runMegaSequence();

      this.modalRef.result.finally(() => {
        this.isMegaAnimating = false;
        this.isCryPhase = false;
        this.selectedMegaForm = null;
        this.selectedPokemonForMega = null;
        this.mode = 'select-pokemon';
      });
    } catch {
      this.megaEvolutionFinished.emit();
    }
  }

  /**
   * Runs the Mega popup: blink, cry, close.
   *
   * The cry is fetched while the blink plays rather than after it, and the popup closes the
   * moment the cry ends. MIN_VISIBLE_MS only stops the window flashing past when the audio
   * resolves instantly or is muted.
   */
  private async runMegaSequence(): Promise<void> {
    const shownAt = Date.now();
    const mega = this.selectedMegaForm;

    try {
      // Resolve the cry while the rings are already spinning, so the sound is buffered by
      // the time the flash needs it instead of being hunted for afterwards.
      const cry = mega
        ? this.cryService.resolvePlayableCry(mega.apiName, mega.pokemonId).catch(() => null)
        : Promise.resolve(null);

      // Hold for the flash — the moment the old form is overwritten by the new one.
      await this.wait(MEGA_FLASH_MS - (Date.now() - shownAt));

      const audio = await cry;
      if (audio) void this.cryService.playResolvedCry(audio);

      // Let the reveal finish settling before the window goes away.
      await this.wait(MEGA_ANIMATION_MS - (Date.now() - shownAt));

      this.isMegaAnimating = false;
      this.isCryPhase = true;

      // A beat on the finished form, so the new Pokémon is actually readable.
      await this.wait(MEGA_HOLD_MS);
    } catch {
      // A failed cry must never strand the popup.
    } finally {
      try {
        this.modalRef?.close();
      } finally {
        this.megaEvolutionFinished.emit();
      }
    }
  }

  private wait(ms: number): Promise<void> {
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  }
}
