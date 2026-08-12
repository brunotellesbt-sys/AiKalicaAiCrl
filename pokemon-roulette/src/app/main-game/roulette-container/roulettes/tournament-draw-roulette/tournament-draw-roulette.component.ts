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

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import {
  Competitor,
  TournamentService,
} from '../../../../services/tournament-service/tournament.service';

const SLICE_COLOURS = [
  'crimson',
  'darkorange',
  'darkgoldenrod',
  'green',
  'darkcyan',
  'blue',
  'purple',
  'deeppink',
];

/**
 * The seeding draw: one spin per competitor, in the order they come out of the bag.
 *
 * The wheel only ever carries the trainers still waiting to be drawn, so it shrinks as the
 * field fills and the last competitor drops in without a spin. Every entrant lands in
 * exactly one seed — the wheel is a shuffle being revealed, not repeated random picks.
 */
@Component({
  selector: 'app-tournament-draw-roulette',
  standalone: true,
  imports: [WheelComponent, TranslatePipe, ImgFallbackDirective],
  templateUrl: './tournament-draw-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tournament-draw-roulette.component.css',
})
export class TournamentDrawRouletteComponent implements OnInit, OnDestroy {
  constructor(
    private modalService: NgbModal,
    private gameStateService: GameStateService,
    private tournamentService: TournamentService,
    private translate: TranslateService
  ) {}

  private gameSubscription: Subscription | null = null;

  @ViewChild('drawnModal', { static: true }) drawnModal!: TemplateRef<any>;

  @Output() drawCompleteEvent = new EventEmitter<void>();

  slices: WheelItem[] = [];
  lastDrawn: Competitor | null = null;

  get seeded(): Competitor[] {
    return this.tournamentService.seededOrder;
  }

  get remaining(): number {
    return this.tournamentService.remainingToDraw;
  }

  get fieldSize(): number {
    return this.tournamentService.fieldSize;
  }

  /** Guards against the draw being completed twice — the emit has several callers. */
  private completed = false;

  ngOnInit(): void {
    this.gameSubscription = this.gameStateService.currentState.subscribe((state) => {
      if (state !== 'tournament-draw') return;

      this.completed = false;
      this.refreshSlices();

      // Nothing left to draw on the way in: the wheel would render zero slices and the
      // player would be looking at a spin button that can never do anything.
      this.finishIfDrawn();
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
  }

  onItemSelected(index: number): void {
    // The slice the wheel stopped on is the competitor that gets seeded.
    this.lastDrawn = this.tournamentService.drawNext(index);
    this.refreshSlices();

    if (!this.lastDrawn) {
      this.finishIfDrawn();
      return;
    }

    const dialog = this.modalService.open(this.drawnModal, { centered: true, size: 'md' });

    // Advance when the dialog goes away, whichever way it goes away.
    //
    // This used to hang off the Ok button alone, so closing the last one by tapping the
    // backdrop or pressing Escape left the draw stranded: every competitor was seeded, the
    // wheel had no slices left to draw, and the completion event that moves the run on had
    // never fired. Both tournaments could end up parked on "Seeded 17 of 17" with nothing
    // on screen but a spin button. `result` rejects on a dismiss and resolves on a close,
    // so both paths get handled here.
    dialog.result.then(
      () => this.finishIfDrawn(),
      () => this.finishIfDrawn()
    );
  }

  closeModal(): void {
    this.modalService.dismissAll();
  }

  /**
   * Seeds everyone still in the bag at once.
   *
   * A World Tournament draw is over 150 spins, one competitor at a time, before a single
   * battle is fought — watching it is a chore rather than a decision, since the player has
   * no influence over where anyone lands. Skipping straight to the finished draw uses the
   * same `drawNext()` the wheel does, so the result is a shuffle revealed all at once
   * rather than a different kind of draw.
   */
  drawAll(): void {
    // Bounded by the bag rather than a while(true): a drawNext() that ever returned null
    // early would otherwise spin forever.
    for (let left = this.remaining; left > 0; left--) {
      if (!this.tournamentService.drawNext()) break;
    }

    this.refreshSlices();
    this.finishIfDrawn();
  }

  /** Emits once the field is full, from whichever path got us there. */
  private finishIfDrawn(): void {
    if (this.completed || this.remaining > 0) return;

    this.completed = true;
    this.drawCompleteEvent.emit();
  }

  /** A competitor's display name is sometimes a translation key, sometimes a literal. */
  isTranslationKey(name: string): boolean {
    return name.includes('.');
  }

  private refreshSlices(): void {
    const pending = this.tournamentService.pendingDraw;

    this.slices = pending.map((competitor, i) => ({
      // The wheel paints straight onto a canvas, so it never passes through the translate
      // pipe — a key put here would be drawn as "gymLeaders.volkner.name".
      text: this.displayName(competitor.name),
      fillStyle: SLICE_COLOURS[i % SLICE_COLOURS.length],
      weight: 1,
    }));
  }

  private displayName(name: string): string {
    return this.isTranslationKey(name) ? this.translate.instant(name) : name;
  }
}
