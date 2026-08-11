import { WheelItem } from '../../interfaces/wheel-item';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { ItemItem } from '../../interfaces/item-item';
import { EnemyPokemon, TypeAdvantage } from './enemy-team.service';

const YES: WheelItem = { text: 'Yes', fillStyle: 'green', weight: 1 };
const NO: WheelItem = { text: 'No', fillStyle: 'crimson', weight: 1 };

/**
 * How much of the opponent's raw power reaches the wheel.
 *
 * Their squad is compared against yours on the same 1-6 scale, halved so a full six-strong
 * end-game team tilts the wheel hard without making it unwinnable.
 */
const ENEMY_POWER_WEIGHT = 0.5;

export interface VictoryOddsInput {
  playerTeam: PokemonItem[];
  items: ItemItem[];
  /** Badges earned so far — the Classic difficulty curve. */
  currentRound: number;
  /** Empty in Classic mode. */
  enemyTeam: EnemyPokemon[];
  typeAdvantage: TypeAdvantage | null;
  isTypeAdvantageMode: boolean;
  /** Overrides the round penalty for opponents that do not sit on the gym ladder. */
  flatDifficulty?: number;
}

/**
 * Builds the victory wheel for any battle in the game.
 *
 * Classic keeps the original model: one base "Yes", one per point of your team's power, and
 * a "No" per badge earned.
 *
 * Type Advantage mode replaces the badge counter with the opponent's *actual* squad. The
 * badge count was only ever a stand-in for "the opponent got stronger", and it made a
 * fourth-badge rival fielding four fully evolved Pokémon read exactly the same as one
 * fielding four unevolved ones — the wheel sat at 50/50 against a team it had no business
 * beating. Power, type matchup and being outnumbered now each move it.
 */
export function buildVictoryOdds(input: VictoryOddsInput): WheelItem[] {
  const {
    playerTeam,
    items,
    currentRound,
    enemyTeam,
    typeAdvantage,
    isTypeAdvantageMode,
    flatDifficulty,
  } = input;

  const odds: WheelItem[] = [{ ...YES }];

  const playerPower = playerTeam.reduce((sum, p) => sum + p.power, 0);
  for (let i = 0; i < playerPower; i++) odds.push({ ...YES });

  for (let i = 0; i < xAttackBonus(playerTeam, items); i++) odds.push({ ...YES });

  odds.push({ ...NO });

  if (isTypeAdvantageMode && enemyTeam.length) {
    const enemyPower = enemyTeam.reduce((sum, p) => sum + p.power, 0);
    for (let i = 0; i < Math.ceil(enemyPower * ENEMY_POWER_WEIGHT); i++) odds.push({ ...NO });

    // Being outnumbered is its own problem — but only past the first missing Pokémon. The
    // team-size table deliberately gives early leaders one more than the player, so charging
    // for that gap would tax every early gym twice: once here and once through the extra
    // Pokémon's power above.
    const outnumbered = Math.max(0, enemyTeam.length - playerTeam.length - 1);
    for (let i = 0; i < outnumbered; i++) odds.push({ ...NO });
  } else {
    const penalty = flatDifficulty ?? currentRound;
    for (let i = 0; i < penalty; i++) odds.push({ ...NO });
  }

  // The matchup tilts the same bag of slices everything else uses, so it stacks naturally.
  const slices = typeAdvantage?.slices ?? 0;
  for (let i = 0; i < Math.abs(slices); i++) {
    odds.push(slices > 0 ? { ...YES } : { ...NO });
  }

  return spreadOutcomes(odds);
}

/**
 * Deals the Yes and No slices around the wheel instead of leaving them in two solid arcs.
 *
 * Purely cosmetic — the same slices go on the wheel, so the probability is exactly what the
 * builder above computed. It is worth doing anyway because two blocks misreport the odds to
 * the eye: a wheel showing one green half and one red half reads as a coin flip whether it
 * is 60/40 or 50/50, since what registers is the arc you are staring at rather than its
 * measured angle. Interleaved slices make a lopsided wheel look lopsided.
 *
 * The minority outcome is dealt to evenly spaced positions with a random starting phase, so
 * two consecutive battles at the same odds do not produce an identical wheel while the
 * spacing stays even. Shuffling instead would clump the colours back together some of the
 * time, which is the thing being fixed.
 *
 * Order carries no meaning downstream: every caller reads the outcome off the chosen slice
 * (`odds[index].text === 'Yes'`) rather than trusting a position, which is what makes
 * reordering safe here.
 */
function spreadOutcomes(odds: WheelItem[]): WheelItem[] {
  const yes = odds.filter((slice) => slice.text === YES.text);
  const no = odds.filter((slice) => slice.text === NO.text);
  if (!yes.length || !no.length) return odds;

  const [minority, majority] = yes.length <= no.length ? [yes, no] : [no, yes];
  const total = minority.length + majority.length;
  const step = total / minority.length;
  const phase = Math.random() * step;

  const slots: (WheelItem | null)[] = new Array(total).fill(null);

  minority.forEach((slice, i) => {
    let at = Math.floor(phase + i * step) % total;
    // Rounding can send two of them to the same slot once the split nears 1:1.
    while (slots[at]) at = (at + 1) % total;
    slots[at] = slice;
  });

  let next = 0;
  for (let i = 0; i < total; i++) {
    if (!slots[i]) slots[i] = majority[next++];
  }

  return slots as WheelItem[];
}

/** Each X Attack adds the team's average power to the "Yes" side. */
function xAttackBonus(playerTeam: PokemonItem[], items: ItemItem[]): number {
  const xAttacks = items.filter((item) => item.name === 'x-attack');
  if (!xAttacks.length || !playerTeam.length) return 0;

  const average = playerTeam.reduce((sum, p) => sum + p.power, 0) / playerTeam.length;
  return Math.floor(xAttacks.length * average);
}
