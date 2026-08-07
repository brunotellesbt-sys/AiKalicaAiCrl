#!/usr/bin/env node
/**
 * Regenerates src/app/data/evolution-finals.ts from PokeAPI.
 *
 * From the 4th gym on, opponents field fully evolved Pokémon, so every species needs to
 * know what it becomes. Branching lines (Eevee, Tyrogue, Wurmple…) keep every terminal
 * form; the caller picks one deterministically.
 *
 * Run with: node scripts/generate-evolution-finals.mjs
 */
import fs from 'node:fs/promises';

const idFromUrl = (url) => Number((url ?? '').split('/').filter(Boolean).pop());

const listRes = await fetch('https://pokeapi.co/api/v2/evolution-chain?limit=1000');
const list = await listRes.json();
const chainUrls = (list.results ?? []).map((r) => r.url);
process.stderr.write(`chains: ${chainUrls.length}\n`);

/** species id -> Set of terminal species ids reachable from it */
const finals = new Map();

function walk(node) {
  const id = idFromUrl(node?.species?.url);
  const kids = node?.evolves_to ?? [];

  if (!kids.length) {
    if (id) finals.set(id, new Set([id]));
    return id ? [id] : [];
  }

  const terminal = [];
  for (const kid of kids) terminal.push(...walk(kid));

  if (id) finals.set(id, new Set(terminal.length ? terminal : [id]));
  return terminal;
}

let done = 0;
let idx = 0;
async function worker() {
  while (idx < chainUrls.length) {
    const i = idx++;
    try {
      const res = await fetch(chainUrls[i]);
      if (!res.ok) continue;
      const chain = await res.json();
      walk(chain.chain);
    } catch {
      // a chain we can't read just keeps its species un-evolved
    }
    if (++done % 100 === 0) process.stderr.write(`${done}/${chainUrls.length}\n`);
  }
}
await Promise.all(Array.from({ length: 10 }, worker));

const ids = [...finals.keys()].filter((id) => id > 0 && id <= 1025).sort((a, b) => a - b);
const lines = ids
  // Only worth shipping when evolving actually changes something.
  .filter((id) => !(finals.get(id).size === 1 && finals.get(id).has(id)))
  .map((id) => `  ${id}: [${[...finals.get(id)].sort((a, b) => a - b).join(', ')}],`);

const file = `/**
 * National Dex id -> the fully evolved form(s) it becomes.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-evolution-finals.mjs
 *
 * Species already in their final form are omitted, so a missing key means "already final".
 * Branching lines keep every terminal form (Eevee lists all Eeveelutions) and the caller
 * picks one deterministically.
 */
export const finalFormsById: Record<number, number[]> = {
${lines.join('\n')}
};

/** Terminal evolutions of a species; the species itself when it is already final. */
export function finalFormsFor(pokemonId: number): number[] {
  return finalFormsById[pokemonId] ?? [pokemonId];
}
`;

await fs.writeFile('src/app/data/evolution-finals.ts', file);
console.log(`wrote src/app/data/evolution-finals.ts with ${lines.length} evolving species`);
