#!/usr/bin/env node
/**
 * Regenerates src/app/data/evolution-stages.ts from PokeAPI.
 *
 * Early gym leaders are supposed to feel early. Their canonical roster is scraped in
 * document order, which mixes in rematch and remake parties, so Roxanne — the *first* gym
 * of Hoenn — could field Golem, a third-stage Pokémon, in her third slot. Capping by stage
 * needs two things: how deep in its line a species sits, and what it evolves back into.
 *
 * Run with: node scripts/generate-evolution-stages.mjs
 */
import fs from 'node:fs/promises';

const idFromUrl = (url) => Number((url ?? '').split('/').filter(Boolean).pop());

const listRes = await fetch('https://pokeapi.co/api/v2/evolution-chain?limit=1000');
const list = await listRes.json();
const chainUrls = (list.results ?? []).map((r) => r.url);
process.stderr.write(`chains: ${chainUrls.length}\n`);

/** species id -> 1 (basic), 2 (middle), 3 (final of a three-stage line), ... */
const stage = new Map();
/** species id -> the species it evolved from, when it has one */
const previous = new Map();

function walk(node, depth, parentId) {
  const id = idFromUrl(node?.species?.url);
  if (!id) return;

  stage.set(id, depth);
  if (parentId) previous.set(id, parentId);

  for (const kid of node?.evolves_to ?? []) walk(kid, depth + 1, id);
}

let done = 0;
let idx = 0;
const concurrency = 12;

async function worker() {
  while (idx < chainUrls.length) {
    const url = chainUrls[idx++];
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      walk(json?.chain, 1, 0);
    } catch {
      // A chain we cannot read simply keeps its default stage of 1.
    }
    done++;
    if (done % 100 === 0) process.stderr.write(`${done}/${chainUrls.length}\n`);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

const stageEntries = [...stage.entries()]
  .filter(([id, depth]) => id <= 1025 && depth > 1)
  .sort((a, b) => a[0] - b[0]);

const prevEntries = [...previous.entries()]
  .filter(([id, from]) => id <= 1025 && from <= 1025)
  .sort((a, b) => a[0] - b[0]);

const file = `/**
 * How deep each species sits in its evolution line, and what it came from.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-evolution-stages.mjs
 *
 * Only species above stage 1 are listed; anything absent is a basic Pokémon.
 */

/** species id -> 2 (middle), 3 (final of a three-stage line), ... */
export const evolutionStageById: Record<number, number> = {
${stageEntries.map(([id, depth]) => `  ${id}: ${depth},`).join('\n')}
};

/** species id -> the species it evolves from. */
export const preEvolutionById: Record<number, number> = {
${prevEntries.map(([id, from]) => `  ${id}: ${from},`).join('\n')}
};

/** 1 for a basic Pokémon, 2 for a middle stage, 3 for a final stage. */
export function evolutionStageOf(speciesId: number): number {
  return evolutionStageById[speciesId] ?? 1;
}

/**
 * Walks a species back down its line until it is no deeper than \`maxStage\`.
 *
 * Used to keep early gyms early: Roxanne's Golem becomes Graveler at a stage-2 cap and
 * Geodude at a stage-1 one, instead of a third-stage Pokémon turning up at the first badge.
 */
export function cappedToStage(speciesId: number, maxStage: number): number {
  let current = speciesId;

  // Bounded: every walk strictly decreases the stage.
  for (let guard = 0; guard < 5; guard++) {
    if (evolutionStageOf(current) <= maxStage) return current;
    const before = preEvolutionById[current];
    if (!before) return current;
    current = before;
  }

  return current;
}
`;

await fs.writeFile('src/app/data/evolution-stages.ts', file);
console.log(`wrote src/app/data/evolution-stages.ts (${stageEntries.length} evolved species)`);
