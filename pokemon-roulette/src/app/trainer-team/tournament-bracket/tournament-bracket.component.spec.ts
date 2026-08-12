import { TestBed } from '@angular/core/testing';

import { TournamentBracketComponent } from './tournament-bracket.component';
import {
  Competitor,
  TournamentMatch,
  TournamentService,
} from '../../services/tournament-service/tournament.service';

function competitor(id: string): Competitor {
  return {
    id,
    name: id,
    spriteUrl: '',
    generationId: 1,
    roster: [],
    ace: 0,
    themeTypes: [],
    isPlayer: id === 'you',
  };
}

/** A round of `count` ties, named so the assertions can identify them. */
function round(prefix: string, count: number, roundIndex: number): TournamentMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    round: roundIndex,
    index: i,
    a: competitor(`${prefix}${i}a`),
    b: competitor(`${prefix}${i}b`),
    winner: null,
    playerMatch: false,
  }));
}

/**
 * The wall chart splits the draw into two halves that converge on the final, so the maths
 * that decides which ties belong to which side is what these cover. Getting it wrong puts
 * a competitor on both sides of the chart, or leaves the final drawn as an ordinary column
 * with the trophy floating over nothing.
 */
describe('TournamentBracketComponent', () => {
  let bracket: TournamentMatch[][];

  function build(): TournamentBracketComponent {
    TestBed.configureTestingModule({
      imports: [TournamentBracketComponent],
      providers: [
        {
          provide: TournamentService,
          useValue: {
            get kind() {
              return 'regional';
            },
            get stage() {
              return 'knockout';
            },
            get groupTable() {
              return [];
            },
            get bracket() {
              return bracket;
            },
            get qualifiersPerGroup() {
              return 1;
            },
          },
        },
      ],
    });

    return TestBed.createComponent(TournamentBracketComponent).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('splits each round down the middle and mirrors the right half', () => {
    bracket = [round('q', 4, 0), round('s', 2, 1), round('f', 1, 2)];
    const chart = build().board;

    // Four quarter-finals become two a side, two semis become one a side.
    expect(chart.left.map((c) => c.ties.length)).toEqual([2, 1]);
    expect(chart.right.map((c) => c.ties.length)).toEqual([1, 2]);

    // Reversed, so the right half also reads outside-in once laid out right-to-left.
    expect(chart.right.map((c) => c.label)).toEqual(
      chart.left.map((c) => c.label).reverse()
    );
  });

  it('never puts the same tie on both sides', () => {
    bracket = [round('r', 8, 0), round('q', 4, 1), round('s', 2, 2), round('f', 1, 3)];
    const chart = build().board;

    const left = chart.left.flatMap((c) => c.ties);
    const right = chart.right.flatMap((c) => c.ties);
    const overlap = left.filter((tie) => right.includes(tie));

    expect(overlap).toEqual([]);
    // Every tie bar the final is placed exactly once.
    expect(left.length + right.length).toBe(8 + 4 + 2);
  });

  it('lifts the last remaining tie out as the final', () => {
    bracket = [round('s', 2, 0), round('f', 1, 1)];
    const chart = build().board;

    expect(chart.final).not.toBeNull();
    expect(chart.final!.a!.id).toBe('f0a');
    // The final is the centre column, so it must not also appear in a side.
    expect(chart.left.flatMap((c) => c.ties)).not.toContain(chart.final);
    expect(chart.right.flatMap((c) => c.ties)).not.toContain(chart.final);
  });

  it('holds the trophy back until the final is decided', () => {
    bracket = [round('f', 1, 0)];
    expect(build().board.champion).toBeNull();

    // A second component needs a fresh TestBed — configureTestingModule refuses to run
    // once one has been instantiated.
    TestBed.resetTestingModule();

    const decided = round('f', 1, 0);
    decided[0].winner = decided[0].a;
    bracket = [decided];
    expect(build().board.champion!.id).toBe('f0a');
  });

  it('keeps a lone opening round on the chart rather than treating it as the final', () => {
    // A field that starts with several ties and no decided rounds yet: nothing is the final.
    bracket = [round('r', 4, 0)];
    const chart = build().board;

    expect(chart.final).toBeNull();
    expect(chart.left.flatMap((c) => c.ties).length + chart.right.flatMap((c) => c.ties).length)
      .toBe(4);
  });
});
