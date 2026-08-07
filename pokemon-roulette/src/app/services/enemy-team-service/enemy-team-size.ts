/**
 * How many Pokémon a scripted opponent brings.
 *
 * The rules are deliberately asymmetric: early gyms only grow if the player already has
 * a bench, so a one-Pokémon run never faces a full squad, while the 8th gym is always a
 * full 6. Read each row as "first threshold whose limit the player's team fits into".
 */

interface SizeRule {
  /** Applies when the player's team size is <= this. */
  upTo: number;
  size: number;
}

/** Index 0 = first gym … index 7 = eighth gym. */
const GYM_SIZE_RULES: SizeRule[][] = [
  // Gym 1 — 2 if the player is alone, 3 otherwise.
  [{ upTo: 1, size: 2 }, { upTo: Infinity, size: 3 }],
  // Gym 2 — 3 while the player has up to three, 4 from four on.
  [{ upTo: 1, size: 2 }, { upTo: 3, size: 3 }, { upTo: Infinity, size: 4 }],
  // Gym 3 — 4 as soon as the player has three.
  [{ upTo: 2, size: 3 }, { upTo: Infinity, size: 4 }],
  // Gym 4
  [{ upTo: 2, size: 3 }, { upTo: 3, size: 4 }, { upTo: Infinity, size: 5 }],
  // Gym 5
  [{ upTo: 3, size: 4 }, { upTo: Infinity, size: 5 }],
  // Gym 6
  [{ upTo: 4, size: 4 }, { upTo: 5, size: 5 }, { upTo: Infinity, size: 6 }],
  // Gym 7
  [{ upTo: 4, size: 5 }, { upTo: Infinity, size: 6 }],
  // Gym 8 — always a full team.
  [{ upTo: Infinity, size: 6 }],
];

/** Elite Four and Champion always field a full squad. */
const ENDGAME_SIZE = 6;

/** 0-based index of the gym from which opponents stop bringing unevolved Pokémon. */
export const FULLY_EVOLVED_FROM_GYM_INDEX = 3; // the 4th gym

/** True once opponents should only field final evolutions. */
export function shouldBeFullyEvolved(nextGymIndex: number): boolean {
  return nextGymIndex >= FULLY_EVOLVED_FROM_GYM_INDEX;
}

/** 0-based index of the gym from which opponents may Mega Evolve. */
export const MEGA_FROM_GYM_INDEX = 4; // the 5th gym

/**
 * True once an opponent is allowed to Mega Evolve.
 *
 * Rosters are scraped in document order and pick up rematch and remake parties, so an early
 * opponent could reach a Pokémon with a Mega form and use it long before the run is ready
 * for one. Gym leaders, rivals and roadside trainers all unlock Megas at the same point:
 * once the fourth badge is won. The Elite Four, the Champion, the villain boss and
 * tournament entrants are end-game opponents and always keep theirs.
 */
export function opponentCanMegaEvolve(nextGymIndex: number): boolean {
  return nextGymIndex >= MEGA_FROM_GYM_INDEX;
}

/**
 * How far an opponent's Pokémon may be evolved before the fully-evolved rule kicks in.
 *
 * The first badge should not be defended by a third-stage Pokémon: Roxanne's scraped roster
 * put Golem in her third slot. The cap ramps with the badge count and then stops mattering,
 * because from the 4th gym everything is a final form anyway.
 */
export function maxEvolutionStage(nextGymIndex: number): number {
  if (nextGymIndex <= 0) return 1; // 1st gym: basics only
  if (nextGymIndex <= 2) return 2; // 2nd and 3rd: middle stages allowed
  return Infinity; // 4th on: shouldBeFullyEvolved() takes over
}

function resolve(rules: SizeRule[], playerTeamSize: number): number {
  const team = Math.max(0, playerTeamSize);
  for (const rule of rules) {
    if (team <= rule.upTo) return rule.size;
  }
  return rules[rules.length - 1]?.size ?? 1;
}

/**
 * @param gymIndex 0-based gym number (0 = first gym).
 * @param playerTeamSize how many Pokémon the player currently has on the team.
 */
export function gymLeaderTeamSize(gymIndex: number, playerTeamSize: number): number {
  const rules = GYM_SIZE_RULES[Math.min(Math.max(gymIndex, 0), GYM_SIZE_RULES.length - 1)];
  return resolve(rules, playerTeamSize);
}

/**
 * Rivals and roadside trainers scale to the gym the player is heading towards, so an
 * optional fight never feels lighter or heavier than the badge it sits between.
 *
 * @param nextGymIndex 0-based index of the gym that will be faced next.
 */
export function scaledTrainerTeamSize(nextGymIndex: number, playerTeamSize: number): number {
  return gymLeaderTeamSize(nextGymIndex, playerTeamSize);
}

export function eliteFourTeamSize(): number {
  return ENDGAME_SIZE;
}

export function villainBossTeamSize(playerTeamSize: number): number {
  // The boss shows up after the 8th badge, so it matches the hardest gym rung.
  return gymLeaderTeamSize(GYM_SIZE_RULES.length - 1, playerTeamSize);
}
