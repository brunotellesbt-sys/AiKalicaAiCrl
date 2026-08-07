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

import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { TournamentKind } from '../../../../services/tournament-service/tournament.service';

/**
 * The invitation that follows a Champion win.
 *
 * Two tournaments share this screen: the regional one straight after the Champion, and the
 * World Tournament that a regional title unlocks. Declining is always allowed and drops the
 * player into the ending, so a player who just wants the credits is never trapped.
 */
@Component({
  selector: 'app-tournament-offer',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './tournament-offer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tournament-offer.component.css',
})
export class TournamentOfferComponent implements OnInit, OnDestroy {
  constructor(
    private modalService: NgbModal,
    private gameStateService: GameStateService
  ) {}

  private gameSubscription: Subscription | null = null;

  @ViewChild('offerModal', { static: true }) offerModal!: TemplateRef<any>;

  /** Which invitation is on the table. Set by the container before the state opens. */
  @Input() kind: TournamentKind = 'regional';

  @Output() acceptEvent = new EventEmitter<TournamentKind>();
  @Output() declineEvent = new EventEmitter<void>();

  ngOnInit(): void {
    this.gameSubscription = this.gameStateService.currentState.subscribe((state) => {
      if (state !== 'tournament-offer') return;
      this.modalService.open(this.offerModal, {
        centered: true,
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
      });
    });
  }

  ngOnDestroy(): void {
    this.gameSubscription?.unsubscribe();
  }

  accept(): void {
    this.modalService.dismissAll();
    this.acceptEvent.emit(this.kind);
  }

  decline(): void {
    this.modalService.dismissAll();
    this.declineEvent.emit();
  }
}
