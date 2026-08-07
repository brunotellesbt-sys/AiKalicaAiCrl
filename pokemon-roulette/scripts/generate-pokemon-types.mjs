#!/usr/bin/env node
/**
 * Regenerates src/app/data/pokemon-types.ts from PokeAPI.
 *
 * Why a generated table instead of calling the API at runtime: the Type Advantage mode
 * needs the typing of every Pokémon in the dex to build an opponent's team, and doing
 * that over the network would mean hundreds of requests mid-battle. Inverting the 18
 * /type endpoints costs 18 requests here and zero while playing.
 *
 * Run with: node scripts/generate-pokemon-types.mjs
 */
import fs from 'node:fs/promises';

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

const byId = new Map();

for (const type of TYPES) {
  const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
  if (!res.ok) throw new Error(`type/${type} -> HTTP ${res.status}`);
  const json = await res.json();

  for (const entry of json.pokemon ?? []) {
    const url = entry?.pokemon?.url ?? '';
    const id = Number(url.split('/').filter(Boolean).pop());
    if (!Number.isFinite(id) || id <= 0) continue;

    const slot = entry?.slot === 2 ? 1 : 0;
    const current = byId.get(id) ?? [];
    current[slot] = type;
    byId.set(id, current);
  }
  process.stderr.write(`${type} ✓\n`);
}

// Alternate-form ids (>10000) are only kept for Mega / Primal / Ultra forms, because those
// change typing mid-battle (Mega Charizard X becomes Fire/Dragon) and the advantage score
// has to follow. Every other alternate form is dropped to keep the table small.
const megaLike = new Set();
{
  const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=100000');
  const json = await res.json();
  for (const entry of json.results ?? []) {
    const name = entry.name ?? '';
    if (!(name.includes('-mega') || name.endsWith('-primal') || name.endsWith('-ultra'))) continue;
    megaLike.add(Number((entry.url ?? '').split('/').filter(Boolean).pop()));
  }
  process.stderr.write(`mega-like forms kept: ${megaLike.size}\n`);
}

for (const id of [...byId.keys()]) {
  if (id > 10000 && !megaLike.has(id)) byId.delete(id);
}

const ids = [...byId.keys()].sort((a, b) => a - b);
const lines = ids.map((id) => `  ${id}: [${byId.get(id).filter(Boolean).map((t) => `'${t}'`).join(', ')}],`);

const file = `import { PokemonType } from './type-chart';

/**
 * National Dex id -> types.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-pokemon-types.mjs
 *
 * Shipped locally so the Type Advantage mode can score a matchup instantly instead of
 * hitting PokeAPI once per Pokémon in the middle of a battle.
 */
export const pokemonTypesById: Record<number, PokemonType[]> = {
${lines.join('\n')}
};

/** Types of a Pokémon by dex id; empty when the id is unknown. */
export function typesForPokemonId(pokemonId: number): PokemonType[] {
  return pokemonTypesById[pokemonId] ?? [];
}
`;

await fs.writeFile('src/app/data/pokemon-types.ts', file);
console.log(`wrote src/app/data/pokemon-types.ts with ${ids.length} entries`);
