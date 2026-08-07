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

  return odds;
}

/** Each X Attack adds the team's average power to the "Yes" side. */
function xAttackBonus(playerTeam: PokemonItem[], items: ItemItem[]): number {
  const xAttacks = items.filter((item) => item.name === 'x-attack');
  if (!xAttacks.length || !playerTeam.length) return 0;

  const average = playerTeam.reduce((sum, p) => sum + p.power, 0) / playerTeam.length;
  return Math.floor(xAttacks.length * average);
}
