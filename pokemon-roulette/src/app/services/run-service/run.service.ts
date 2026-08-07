import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type GameMode = 'classic' | 'type-advantage';

export const STARTING_LIVES = 3;

/**
 * Run-scoped state that sits outside the state machine: which mode is being played, how
 * many lives are left, and the one-shot flags that must not fire twice when the player
 * re-enters the Elite Four.
 *
 * Classic mode never reads any of this, so the original game is untouched.
 */
@Injectable({ providedIn: 'root' })
export class RunService {
  private modeSubject$ = new BehaviorSubject<GameMode>('classic');
  private livesSubject$ = new BehaviorSubject<number>(STARTING_LIVES);

  /** Set once the villain boss has been beaten, so an Elite Four retry skips it. */
  private villainBossCleared = false;
  /** Set once the post-boss legendary has been offered — it only ever appears once. */
  private legendaryOffered = false;

  readonly mode$: Observable<GameMode> = this.modeSubject$.asObservable();
  readonly lives$: Observable<number> = this.livesSubject$.asObservable();

  get mode(): GameMode {
    return this.modeSubject$.value;
  }

  get isTypeAdvantageMode(): boolean {
    return this.modeSubject$.value === 'type-advantage';
  }

  get lives(): number {
    return this.livesSubject$.value;
  }

  setMode(mode: GameMode): void {
    this.modeSubject$.next(mode);
  }

  /**
   * Spends a life.
   * @returns true when the run continues, false when that was the last one.
   */
  loseLife(): boolean {
    const remaining = Math.max(0, this.livesSubject$.value - 1);
    this.livesSubject$.next(remaining);
    return remaining > 0;
  }

  markVillainBossCleared(): void {
    this.villainBossCleared = true;
  }

  get hasClearedVillainBoss(): boolean {
    return this.villainBossCleared;
  }

  markLegendaryOffered(): void {
    this.legendaryOffered = true;
  }

  get hasBeenOfferedLegendary(): boolean {
    return this.legendaryOffered;
  }

  /** Keeps the chosen mode — restarting a run shouldn't kick you back to Classic. */
  resetRun(): void {
    this.livesSubject$.next(STARTING_LIVES);
    this.villainBossCleared = false;
    this.legendaryOffered = false;
  }
}
