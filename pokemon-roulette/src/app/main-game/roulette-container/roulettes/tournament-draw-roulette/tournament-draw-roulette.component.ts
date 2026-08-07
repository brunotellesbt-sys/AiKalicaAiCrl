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

  ngOnInit(): void {
    this.gameSubscription = this.gameStateService.currentState.subscribe((state) => {
      if (state !== 'tournament-draw') return;
      this.refreshSlices();
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
      this.drawCompleteEvent.emit();
      return;
    }

    this.modalService.open(this.drawnModal, { centered: true, size: 'md' });
  }

  closeModal(): void {
    this.modalService.dismissAll();

    if (this.remaining === 0) {
      this.drawCompleteEvent.emit();
    }
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
