import { Injectable } from '@angular/core';
import { GameState } from './game-state';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {

  private stateStack: GameState[] = [];
  private state = new BehaviorSubject<GameState>('game-start');
  currentState = this.state.asObservable();

  private currentRound = new BehaviorSubject<number>(0);
  currentRoundObserver = this.currentRound.asObservable();

  private wheelSpinning = new BehaviorSubject<boolean>(false);
  wheelSpinningObserver = this.wheelSpinning.asObservable();

  constructor() {
    this.initializeStates();
  }

  private initializeStates(): void {
    this.stateStack = [
      'game-finish',
      // Beating the Champion opens the Pokémon World Tournament. Declining pops straight
      // through to 'game-finish', so the credits still close a Classic run unchanged.
      'tournament-offer',
      'champion-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-preparation',
      // New: generation villain boss encounter before the Elite Four.
      // (Inserted after the last gym and before Elite Four preparation in pop order.)
      'villain-boss-encounter',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'adventure-continues',
      'gym-battle',
      'mega-evolution',
      'start-adventure',
      'starter-pokemon',
      'character-select',
      // Popped first (LIFO): the run mode is chosen right after the region.
      'mode-select'
    ];
  }

  /**
   * Rebuilds the run from the point where the player heads to the 8th gym again.
   *
   * Used when a life is spent inside the Elite Four: the challenge is abandoned and the
   * player returns through the last gym. The villain boss and the one-off legendary are
   * deliberately left out — they already happened this run.
   */
  restartEliteFourRun(): void {
    this.stateStack = [
      'game-finish',
      'tournament-offer',
      'champion-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-battle',
      'mega-evolution',
      'elite-four-preparation',
      'gym-battle',
      'mega-evolution',
      'adventure-continues'
    ];
  }

  /**
   * Queues another run-up to the gym that was just lost: the pre-gym adventure wheel, a
   * Mega chance, then the same leader again.
   */
  retryCurrentGym(): void {
    this.stateStack.push('gym-battle');
    this.stateStack.push('mega-evolution');
    this.stateStack.push('adventure-continues');
  }

  /**
   * Queues the run-up to a tournament: the restricted catch wheel, then the seeding draw.
   *
   * LIFO, so the prep wheel is pushed last and therefore runs first — the player fills the
   * six team slots *before* seeing who they are drawn against.
   */
  startTournament(): void {
    this.stateStack.push('tournament-draw');
    this.stateStack.push('tournament-prep');
  }

  /** Queues the next tournament match. */
  queueTournamentBattle(): void {
    this.stateStack.push('tournament-battle');
  }

  /** Queues the catch wheel that sits between the group stage and the knockout bracket. */
  queueTournamentPrep(): void {
    this.stateStack.push('tournament-prep');
  }

  /**
   * Steps the round counter back so a retried gym is the same leader, not the next one.
   *
   * Call this AFTER finishCurrentState(): leaving a battle state always bumps the round,
   * so the rewind has to undo that bump. Doing it before instead means the clamp at zero
   * swallows it and the first gym advances anyway — losing to Brock sent you to Misty.
   */
  rewindRound(): void {
    this.currentRound.next(Math.max(0, this.currentRound.value - 1));
  }

  /** Forces the round counter, used when a run jumps back to a known point. */
  setRound(round: number): void {
    this.currentRound.next(Math.max(0, round));
  }

  setNextState(newState: GameState): void {
    this.stateStack.push(newState);
  }

  finishCurrentState(): GameState {

    if(['gym-battle', 'elite-four-battle', 'champion-battle'].includes(this.state.value)) {
      this.currentRound.next(this.currentRound.value + 1);
    }

    if (this.stateStack.length > 0) {
      const poppedState = this.stateStack.pop();
      if(poppedState) {
        if(poppedState === 'game-over') {
          this.currentRound.next(this.currentRound.value - 1);
        }
        this.state.next(poppedState);
        return poppedState;
      }
    }
    return 'game-over';
  }

  repeatCurrentState(): void {
    this.stateStack.push(this.state.value);
  }

  setWheelSpinning(state: boolean): void {
    this.wheelSpinning.next(state);
  }

  resetGameState(): void {
    this.initializeStates();
    this.setNextState('game-start');
    this.finishCurrentState();
    this.currentRound.next(0);
  }
}
