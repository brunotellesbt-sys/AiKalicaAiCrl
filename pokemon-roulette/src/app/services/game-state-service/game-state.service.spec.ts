import { TestBed } from '@angular/core/testing';

import { GameStateService } from './game-state.service';
import { GameState } from './game-state';

/**
 * These specs walk the state machine the way a run does, because the round counter is the
 * thing that decides which gym leader you face and which badge you are handed, and it is
 * moved as a *side effect* of leaving a battle state. That makes it easy to get one bump
 * out of step and hard to notice: the symptom shows up a screen or two later as the wrong
 * badge, a skipped gym, or a leader lookup that runs off the end of the table.
 */
describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameStateService);
  });

  /** Current state without subscribing — the observable is a BehaviorSubject underneath. */
  function currentState(): GameState {
    let seen!: GameState;
    service.currentState.subscribe((s) => (seen = s)).unsubscribe();
    return seen;
  }

  function currentRound(): number {
    let seen = 0;
    service.currentRoundObserver.subscribe((r) => (seen = r)).unsubscribe();
    return seen;
  }

  /**
   * Plays forward until the given state is current.
   *
   * Bounded so a machine that never reaches it fails the spec instead of hanging the suite.
   */
  function advanceTo(target: GameState, limit = 60): boolean {
    for (let i = 0; i < limit; i++) {
      if (currentState() === target) return true;
      service.finishCurrentState();
    }
    return currentState() === target;
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('numbers the eight gyms 0 to 7, so leader and badge lookups line up', () => {
    const seen: number[] = [];

    for (let gym = 0; gym < 8; gym++) {
      expect(advanceTo('gym-battle')).toBe(true);
      seen.push(currentRound());
      service.finishCurrentState(); // won it
    }

    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('leaves the round pointing past the last gym when the Elite Four opens', () => {
    for (let gym = 0; gym < 8; gym++) {
      advanceTo('gym-battle');
      service.finishCurrentState();
    }

    expect(advanceTo('elite-four-preparation')).toBe(true);
    // Eight gyms won. Anything less means a gym was skipped; more means one was double-counted.
    expect(currentRound()).toBe(8);
  });

  it('replays the same leader after a lost gym, not the next one', () => {
    advanceTo('gym-battle');
    expect(currentRound()).toBe(0);

    // The losing path in the container: queue the run-up again, finish, then undo the bump
    // that leaving a battle state performs. Order matters — rewinding first lets the clamp
    // at zero swallow it, which is what used to send a player who lost the first gym to
    // the second one.
    service.retryCurrentGym();
    service.finishCurrentState();
    service.rewindRound();

    expect(advanceTo('gym-battle')).toBe(true);
    expect(currentRound()).toBe(0);
  });

  it('comes back to the last gym after the Elite Four is abandoned', () => {
    for (let gym = 0; gym < 8; gym++) {
      advanceTo('gym-battle');
      service.finishCurrentState();
    }
    advanceTo('elite-four-battle');
    service.finishCurrentState(); // lost it

    service.restartEliteFourRun();
    service.setRound(7);

    // The run resumes through the pre-gym wheel and faces the eighth leader again.
    expect(advanceTo('gym-battle')).toBe(true);
    expect(currentRound()).toBe(7);
  });
});
