import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import { GymBattleRouletteComponent } from './gym-battle-roulette.component';
import { GameStateService } from '../../../../services/game-state-service/game-state.service';
import { WheelItem } from '../../../../interfaces/wheel-item';

/**
 * The badge a gym win awards used to be looked up from the container's live round counter
 * when the result was handled, guarded by a check on the live game state. Both could move
 * between the battle starting and the result arriving, and each broke it its own way: a
 * moved counter awarded the NEXT leader's badge, a moved state awarded NOTHING. Together
 * that is the reported symptom — the next gym's badge arrives and the current gym's never
 * does.
 *
 * The rung is now fixed when the leader is chosen and travels up with the result. These
 * cover the property the fix rests on: what the component reports describes the fight it
 * actually ran, whatever happens to the counter afterwards.
 *
 * The template is overridden away on purpose. It renders the leader, the enemy team panel
 * and two dialogs, none of which these assertions touch, and standing all of that up in
 * jsdom tests the harness rather than the rule.
 */
describe('GymBattleRouletteComponent', () => {
  let fixture: ComponentFixture<GymBattleRouletteComponent>;
  let component: GymBattleRouletteComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GymBattleRouletteComponent],
      providers: [
        { provide: GameStateService, useValue: { currentState: of('idle'), setWheelSpinning: () => {} } },
        { provide: NgbModal, useValue: { open: () => ({ result: Promise.resolve() }), dismissAll: () => {} } },
      ],
    })
      .overrideComponent(GymBattleRouletteComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(GymBattleRouletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Places the component on a rung the way entering the gym state does. */
  function atGym(round: number): void {
    component.generation = { text: 'Gen 1', region: 'Kanto', fillStyle: 'crimson', id: 1, weight: 1 };
    component.currentRound = round;
    component.currentLeader = component['getCurrentLeader']();
  }

  const slice = (text: string): WheelItem => ({ text, fillStyle: 'green', weight: 1 });

  function reportOf(fn: () => void): { won: boolean; round: number } {
    let seen!: { won: boolean; round: number };
    const sub = component.battleResultEvent.subscribe((r) => (seen = r));
    fn();
    sub.unsubscribe();
    return seen;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports the rung it was placed on when the battle is won', () => {
    atGym(3);
    expect(reportOf(() => component.onItemSelected(slice('Yes')))).toEqual({ won: true, round: 3 });
  });

  it('keeps reporting the rung it fought, even after the counter moves on', () => {
    atGym(3);

    // The race the bug came from: something advances the counter between the battle
    // starting and its result being handled. The old code read this and awarded the
    // fourth leader's badge for the third leader's fight.
    component.currentRound = 4;

    expect(reportOf(() => component.onItemSelected(slice('Yes'))).round).toBe(3);
  });

  it('reports the same rung on a loss, so a retry replays the same leader', () => {
    atGym(0);
    // Emptied first: a trainer starts the run holding a Potion, and a loss spends that on
    // another spin rather than ending the battle. The result only stands once the bag is
    // out, which is the case this covers.
    component.trainerItems = [];

    expect(reportOf(() => component.onItemSelected(slice('No')))).toEqual({ won: false, round: 0 });
  });

  it('spends a Potion on a loss instead of ending the battle', () => {
    atGym(0);
    const potions = component.trainerItems.length;
    expect(potions).toBeGreaterThan(0);

    let reported = false;
    const sub = component.battleResultEvent.subscribe(() => (reported = true));
    component.onItemSelected(slice('No'));
    sub.unsubscribe();

    expect(reported).toBe(false);
    expect(component.trainerItems.length).toBe(potions - 1);
  });

  it('clamps a rung past the end of the ladder instead of failing the lookup', () => {
    // Kanto has eight leaders; asking for the tenth used to evaluate to undefined and take
    // the run down on the way to the Elite Four.
    expect(() => atGym(9)).not.toThrow();
    expect(component.currentLeader).toBeTruthy();
  });
});
