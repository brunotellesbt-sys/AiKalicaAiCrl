#!/usr/bin/env node
/**
 * Regenerates src/app/data/mega-by-species.ts from PokeAPI.
 *
 * In Type Advantage mode an opponent always Mega Evolves their signature Pokémon when one
 * is available, so the game needs to know which species can Mega Evolve and into what.
 *
 * Run with: node scripts/generate-mega-species-map.mjs
 */
import fs from 'node:fs/promises';

const idFromUrl = (url) => Number((url ?? '').split('/').filter(Boolean).pop());

const listRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=100000');
const list = await listRes.json();

const forms = (list.results ?? [])
  .filter((r) => r.name.includes('-mega') || r.name.endsWith('-primal') || r.name.endsWith('-ultra'))
  .map((r) => ({ name: r.name, id: idFromUrl(r.url) }));

process.stderr.write(`mega-like forms: ${forms.length}\n`);

/** species id -> [{ id, name }] */
const bySpecies = new Map();

let idx = 0;
async function worker() {
  while (idx < forms.length) {
    const form = forms[idx++];
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${form.name}`);
      if (!res.ok) continue;
      const json = await res.json();
      const speciesId = idFromUrl(json?.species?.url);
      if (!speciesId) continue;
      const list = bySpecies.get(speciesId) ?? [];
      list.push({ id: form.id, name: form.name });
      bySpecies.set(speciesId, list);
    } catch {
      // a form we can't read simply never Mega Evolves in game
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const ids = [...bySpecies.keys()].sort((a, b) => a - b);
const lines = ids.map((sid) => {
  const entries = bySpecies
    .get(sid)
    .sort((a, b) => a.id - b.id)
    .map((f) => `{ id: ${f.id}, apiName: '${f.name}' }`)
    .join(', ');
  return `  ${sid}: [${entries}],`;
});

const file = `/**
 * Species id -> the Mega / Primal / Ultra forms it can take.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-mega-species-map.mjs
 */
export interface MegaFormRef {
  id: number;
  apiName: string;
}

export const megaFormsBySpecies: Record<number, MegaFormRef[]> = {
${lines.join('\n')}
};

/** True when this species has a Mega / Primal / Ultra form. */
export function canMegaEvolve(speciesId: number): boolean {
  return (megaFormsBySpecies[speciesId]?.length ?? 0) > 0;
}

export function megaFormsFor(speciesId: number): MegaFormRef[] {
  return megaFormsBySpecies[speciesId] ?? [];
}
`;

await fs.writeFile('src/app/data/mega-by-species.ts', file);
console.log(`wrote src/app/data/mega-by-species.ts with ${ids.length} species`);
