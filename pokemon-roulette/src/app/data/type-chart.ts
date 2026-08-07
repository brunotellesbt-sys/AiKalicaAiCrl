/**
 * Type effectiveness chart (Gen 6+, includes Fairy).
 *
 * Kept local on purpose: PokeAPI exposes the same data at /type/{name}/damage_relations,
 * but that would be 18 extra requests before a battle can be scored — and it would stop
 * working offline. The chart never changes, so shipping it is strictly better.
 *
 * Only the non-neutral relations are listed; everything omitted is 1x.
 */

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export const ALL_TYPES: PokemonType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

interface Relations {
  super?: PokemonType[];
  notVery?: PokemonType[];
  none?: PokemonType[];
}

const CHART: Record<PokemonType, Relations> = {
  normal:   { notVery: ['rock', 'steel'], none: ['ghost'] },
  fire:     { super: ['grass', 'ice', 'bug', 'steel'], notVery: ['fire', 'water', 'rock', 'dragon'] },
  water:    { super: ['fire', 'ground', 'rock'], notVery: ['water', 'grass', 'dragon'] },
  electric: { super: ['water', 'flying'], notVery: ['electric', 'grass', 'dragon'], none: ['ground'] },
  grass:    { super: ['water', 'ground', 'rock'], notVery: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
  ice:      { super: ['grass', 'ground', 'flying', 'dragon'], notVery: ['fire', 'water', 'ice', 'steel'] },
  fighting: { super: ['normal', 'ice', 'rock', 'dark', 'steel'], notVery: ['poison', 'flying', 'psychic', 'bug', 'fairy'], none: ['ghost'] },
  poison:   { super: ['grass', 'fairy'], notVery: ['poison', 'ground', 'rock', 'ghost'], none: ['steel'] },
  ground:   { super: ['fire', 'electric', 'poison', 'rock', 'steel'], notVery: ['grass', 'bug'], none: ['flying'] },
  flying:   { super: ['grass', 'fighting', 'bug'], notVery: ['electric', 'rock', 'steel'] },
  psychic:  { super: ['fighting', 'poison'], notVery: ['psychic', 'steel'], none: ['dark'] },
  bug:      { super: ['grass', 'psychic', 'dark'], notVery: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
  rock:     { super: ['fire', 'ice', 'flying', 'bug'], notVery: ['fighting', 'ground', 'steel'] },
  ghost:    { super: ['psychic', 'ghost'], notVery: ['dark'], none: ['normal'] },
  dragon:   { super: ['dragon'], notVery: ['steel'], none: ['fairy'] },
  dark:     { super: ['psychic', 'ghost'], notVery: ['fighting', 'dark', 'fairy'] },
  steel:    { super: ['ice', 'rock', 'fairy'], notVery: ['fire', 'water', 'electric', 'steel'] },
  fairy:    { super: ['fighting', 'dragon', 'dark'], notVery: ['fire', 'poison', 'steel'] },
};

export function isPokemonType(value: string): value is PokemonType {
  return (ALL_TYPES as string[]).includes(value);
}

/** Damage multiplier of one attacking type against one defending type. */
export function effectiveness(attacker: PokemonType, defender: PokemonType): number {
  const rel = CHART[attacker];
  if (!rel) return 1;
  if (rel.none?.includes(defender)) return 0;
  if (rel.super?.includes(defender)) return 2;
  if (rel.notVery?.includes(defender)) return 0.5;
  return 1;
}

/**
 * Multiplier of an attacker's best type against a (possibly dual-typed) defender.
 *
 * A Pokémon attacks with whichever of its own types works best — that's how a player
 * reads a matchup, and it keeps the score readable instead of averaging everything out.
 */
export function matchupMultiplier(attackerTypes: string[], defenderTypes: string[]): number {
  const attackers = attackerTypes.filter(isPokemonType);
  const defenders = defenderTypes.filter(isPokemonType);
  if (!attackers.length || !defenders.length) return 1;

  let best = 0;
  for (const atk of attackers) {
    const combined = defenders.reduce((mult, def) => mult * effectiveness(atk, def), 1);
    if (combined > best) best = combined;
  }
  return best;
}

/** Types that hit the given (possibly dual) typing for super effective damage. */
export function typesStrongAgainst(defenderTypes: string[]): PokemonType[] {
  return ALL_TYPES.filter((atk) => matchupMultiplier([atk], defenderTypes) > 1);
}
