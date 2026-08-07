#!/usr/bin/env node
/**
 * Regenerates src/app/data/trainer-teams.ts from Bulbapedia.
 *
 * The Type Advantage mode fields the roster each opponent actually uses in the games.
 * Rather than transcribing ~700 entries by hand (and silently getting some wrong), this
 * pulls the party templates straight off each trainer's page.
 *
 * Ordering matters: Bulbapedia lists parties chronologically, so the first entries are the
 * trainer's original team and the later ones come from rematches, remakes and the BW2
 * Pokémon World Tournament. Taking them in document order gives exactly the rule we want —
 * original team first, signature/PWT Pokémon only when more slots are needed.
 *
 * Run with: node scripts/generate-trainer-teams.mjs
 */
import fs from 'node:fs/promises';

const UA = {
  'user-agent': 'pokemon-roulette-data/1.0 (+https://github.com/zeroxm/pokemon-roulette)',
};

/** Some opponents are a combined slot in this game; merge every page listed. */
const GYM_LEADERS = {
  1: [['brock', 'Brock'], ['misty', 'Misty'], ['surge', 'Lt. Surge'], ['erika', 'Erika'],
      ['koga', 'Koga'], ['sabrina', 'Sabrina'], ['blaine', 'Blaine'], ['giovanni', 'Giovanni']],
  2: [['falkner', 'Falkner'], ['bugsy', 'Bugsy'], ['whitney', 'Whitney'], ['morty', 'Morty'],
      ['chuck', 'Chuck'], ['jasmine', 'Jasmine'], ['pryce', 'Pryce'], ['clair', 'Clair']],
  3: [['roxanne', 'Roxanne'], ['brawly', 'Brawly'], ['wattson', 'Wattson'], ['flannery', 'Flannery'],
      ['norman', 'Norman'], ['winona', 'Winona'], ['liza-tate', 'Tate and Liza'], ['juan', 'Juan']],
  4: [['roark', 'Roark'], ['gardenia', 'Gardenia'], ['maylene', 'Maylene'], ['crasher-wake', 'Crasher Wake'],
      ['fantina', 'Fantina'], ['byron', 'Byron'], ['candice', 'Candice'], ['volkner', 'Volkner']],
  5: [['cilan-chili-cress', 'Cilan', 'Chili', 'Cress'], ['lenora', 'Lenora'], ['burgh', 'Burgh'],
      ['elesa', 'Elesa'], ['clay', 'Clay'], ['skyla', 'Skyla'], ['brycen', 'Brycen'],
      ['drayden-iris', 'Drayden', 'Iris']],
  6: [['viola', 'Viola'], ['grant', 'Grant'], ['korrina', 'Korrina'], ['ramos', 'Ramos'],
      ['clemont', 'Clemont'], ['valerie', 'Valerie'], ['olympia', 'Olympia'], ['wulfric', 'Wulfric']],
  7: [['ilima', 'Ilima'], ['hala', 'Hala'], ['lana-kiawe-mallow', 'Lana', 'Kiawe', 'Mallow'],
      ['olivia', 'Olivia'], ['sophocles-acerola', 'Sophocles', 'Acerola'], ['nanu', 'Nanu'],
      ['mina', 'Mina'], ['hapu', 'Hapu']],
  8: [['milo', 'Milo'], ['nessa', 'Nessa'], ['kabu', 'Kabu'], ['bea-allister', 'Bea', 'Allister'],
      ['bede', 'Bede'], ['gordie-melony', 'Gordie', 'Melony'], ['piers', 'Piers'], ['raihan', 'Raihan']],
  9: [['katy', 'Katy'], ['brassius', 'Brassius'], ['iono', 'Iono'], ['kofu', 'Kofu'],
      ['larry', 'Larry'], ['ryme', 'Ryme'], ['tulip', 'Tulip'], ['grusha', 'Grusha']],
};

const ELITE_FOUR = {
  1: [['loreilei', 'Lorelei'], ['bruno-gen1', 'Bruno'], ['agatha', 'Agatha'], ['lance', 'Lance']],
  2: [['will', 'Will'], ['koga', 'Koga'], ['bruno-gen2', 'Bruno'], ['karen', 'Karen']],
  3: [['sidney', 'Sidney'], ['phoebe', 'Phoebe'], ['glacia', 'Glacia'], ['drake', 'Drake']],
  4: [['aaron', 'Aaron'], ['bertha', 'Bertha'], ['flint', 'Flint'], ['lucian', 'Lucian']],
  5: [['shauntal', 'Shauntal'], ['marshal', 'Marshal'], ['grimsley', 'Grimsley'], ['caitlin', 'Caitlin']],
  6: [['malva', 'Malva'], ['siebold', 'Siebold'], ['wikstrom', 'Wikstrom'], ['drasna', 'Drasna']],
  7: [['molayne', 'Molayne'], ['olivia', 'Olivia'], ['acerola', 'Acerola'], ['kahili', 'Kahili']],
  8: [['marnie', 'Marnie'], ['nessa', 'Nessa'], ['bea', 'Bea'], ['raihan', 'Raihan']],
  9: [['rika', 'Rika'], ['poppy', 'Poppy'], ['larry', 'Larry'], ['hassel', 'Hassel']],
};

const CHAMPIONS = {
  1: ['Blue (game)'], 2: ['Lance'], 3: ['Wallace'], 4: ['Cynthia'], 5: ['Alder'],
  6: ['Diantha'], 7: ['Professor Kukui'], 8: ['Leon'], 9: ['Geeta'],
};

/**
 * Villain bosses. These never enter a tournament — they are the run's own set pieces.
 *
 * Regions with two possible bosses are decided by a wheel in game, so each needs its own
 * roster rather than a merged one: Hoenn picks between Magma and Aqua, and Paldea's true
 * boss is the professor behind the Zero Lab, not Team Star's figurehead.
 */
const VILLAIN_BOSSES = {
  1: [['giovanni', 'Giovanni']],
  2: [['proton', 'Giovanni']],
  3: [['maxie', 'Maxie'], ['archie', 'Archie']],
  4: [['cyrus', 'Cyrus']],
  5: [['ghetsis', 'Ghetsis']],
  6: [['lysandre', 'Lysandre']],
  7: [['guzma', 'Guzma']],
  8: [['rose', 'Rose']],
  9: [['sada', 'Professor Sada'], ['turo', 'Professor Turo']],
};

/**
 * "Battle Trainer" encounters, matching data/generation-encounters.ts.
 *
 * Each region offers a wheel of the notable trainers you actually fight there, so every one
 * of them needs their own roster — no one is merged into anyone else. Characters who are
 * already the region's rival are deliberately absent: a person holds one job here.
 */
const BATTLE_TRAINERS = {
  1: [['yellow', 'Yellow (Adventures)'], ['ash', 'Ash Ketchum']],
  2: [['eugene', 'Eusine']],
  // Steven is Hoenn's Champion in RS but not in this game (Wallace holds that slot), and he
  // used to sit in the rival slot by mistake — the roadside wheel is where he belongs.
  3: [['wally', 'Wally'], ['steven', 'Steven Stone']],
  4: [['looker', 'Looker'], ['riley', 'Riley']],
  5: [['bianca', 'Bianca'], ['cheren', 'Cheren'], ['hugh', 'Hugh']],
  6: [['shauna', 'Shauna'], ['tierno', 'Tierno'], ['trevor', 'Trevor']],
  7: [['hau', 'Hau']],
  8: [['hop', 'Hop'], ['bede', 'Bede'], ['klara', 'Klara'], ['avery', 'Avery']],
  // Cassiopeia is Penny's Team Star alias, so she is one person and one entry.
  9: [['cassiopeia', 'Penny'], ['arven', 'Arven']],
};

/**
 * The protagonist the player did not pick, who turns up as an opponent.
 *
 * PROTAGONISTS above holds the male half; this is the female half. In Hoenn and Kalos this
 * counterpart *is* the rival, which is exactly how those games work.
 *
 * Kanto's female lead is Blue: the naming follows the Japanese/Adventures convention, where
 * the male rival is Green (the Champion) and Blue is the girl.
 */
const FEMALE_PROTAGONISTS = {
  1: ['Blue (Adventures)'], 2: ['Lyra (game)'], 3: ['May (game)'], 4: ['Dawn (game)'],
  5: ['Hilda (game)'], 6: ['Serena (game)'], 7: ['Selene (game)'], 8: ['Gloria (game)'],
  9: ['Juliana (game)'],
};

/**
 * Player characters, used only by the World Tournament.
 *
 * They appear as NPCs in later games (Red in GSC/HGSS, Brendan/May as rivals in RSE, and
 * so on), so Bulbapedia carries their strongest scripted party.
 */
const PROTAGONISTS = {
  1: ['Red (game)'], 2: ['Ethan (game)'], 3: ['Brendan (game)'], 4: ['Lucas (game)'],
  5: ['Hilbert (game)'], 6: ['Calem (game)'], 7: ['Elio'], 8: ['Victor (game)'],
  9: ['Florian (game)'],
};

/**
 * One rival per region, matching the name the game shows.
 *
 * The display list and this one used to disagree — Hoenn showed "Steven" while fighting
 * with Wally's team, Kalos showed "Shauna" while fighting with Calem's. Hoenn and Kalos
 * make the rival the protagonist you did not pick, so those two read from the protagonist
 * tables instead and the entries here are only a fallback.
 */
const RIVALS = {
  1: ['Blue (game)'],       // shown as Green: the Japanese name of the male rival
  2: ['Silver (game)'],
  3: ['Brendan (game)'],    // replaced at runtime by the counterpart protagonist
  4: ['Barry (game)'],
  5: ['N'],                 // Hugh moved to the Battle Trainer wheel
  6: ['Calem (game)'],      // replaced at runtime by the counterpart protagonist
  7: ['Gladion'],
  8: ['Marnie'],            // Hop is a Battle Trainer, so the rival slot is Marnie's alone
  9: ['Nemona'],
};

/**
 * Reserve competitors for regions whose scripted cast cannot fill a 16-trainer bracket.
 *
 * Some trainers hold two roles at once, and the field counts people rather than jobs:
 *   - Alola: Olivia is a kahuna and an Elite Four member, Hau is the roadside trainer and
 *     shares the Champion slot with Kukui — 15 names.
 *   - Galar: Nessa, Bea and Raihan all return as Elite Four members after being gym
 *     leaders, and Marnie is both the rival and an Elite Four member — 13 names.
 *   - Paldea: Larry runs the Medali Gym *and* sits in the Elite Four — 15 names.
 *
 * These are the next canonical opponents of each region with a documented party, listed in
 * the order they are drafted in.
 */
const EXTRA_FIELD_TRAINERS = {
  // Villain bosses (Guzma, Rose) are deliberately absent: they are the run's set pieces and
  // never enter a tournament. Klara, Avery and Arven moved to the Battle Trainer wheels.
  7: [['plumeria', 'Plumeria']],
  8: [['peony', 'Peony'], ['mustard', 'Mustard']],
};

/**
 * Aces the level heuristic cannot infer.
 *
 * gameParty() takes the highest-level member of a trainer's *first* listed party, which is
 * the signature for scripted opponents fought once. Arven is battled repeatedly from very
 * low levels, so his first party's top scorer is an early-route Pokémon rather than
 * Mabosstiff, the partner the entire Titan storyline is built around.
 */
const ACE_OVERRIDES = {
  'battleTrainer gen9 arven': 943, // Arven — Mabosstiff
};

/**
 * Rosters Bulbapedia does not expose in a party template, transcribed by hand.
 *
 * Yellow is a Pokémon Adventures (manga) character and has no game party anywhere; Looker's
 * Pokémon are described in prose rather than a {{Pokémon}} block. Without these the two
 * encounters fall back to a randomly filled regional team, which is not the character.
 *
 * Keyed by the same label teamFor() reports.
 */
const MANUAL_ROSTERS = {
  // Yellow (Pokémon Adventures): Pika, Ratty, Dody, Gravvy, Kitty, Omny.
  'battleTrainer gen1 yellow': { ids: [25, 20, 85, 76, 12, 139], ace: 25 },
  // Looker: Croagunk is his signature across Platinum, X/Y and USUM.
  'battleTrainer gen4 looker': { ids: [453], ace: 453 },
  // Ash is an anime character with no game party at all. This is his Kanto team, the one
  // he takes to the Indigo League: Pikachu, Charizard, Bulbasaur, Squirtle, Butterfree,
  // Pidgeot.
  'battleTrainer gen1 ash': { ids: [25, 6, 1, 7, 12, 18], ace: 25 },

  // Blue, the Kanto girl of Pokémon Adventures: Blasty, Ditto, Clefy, Jiggly, Nido, Granbull.
  'protagonistF gen1': { ids: [9, 132, 36, 40, 31, 210], ace: 9 },
  // Crystal, the Johto girl of Pokémon Adventures: Mega, Arcky, Parasee, Natee, Bonee, Chumee.
  'protagonistF gen2': { ids: [154, 59, 47, 178, 105, 124], ace: 154 },

  // Protagonists are the player in their own games, so several have no scripted party and
  // Bulbapedia writes their manga Pokémon in prose rather than a party template. These come
  // from Pokémon Adventures, which is the source the World Tournament falls back to.
  // Gold: Exbo, Aibo, Polibo, Sunbo, Togebo, Sintaro.
  'protagonist gen2': { ids: [157, 190, 186, 185, 468, 215], ace: 157 },
  // Black: Bo, Musha, Tula, Costa, Brav, and the Reshiram he awakens.
  'protagonist gen5': { ids: [500, 518, 596, 565, 628, 643], ace: 500 },
  // Sun: his Rowlet line, Dollar the Alolan Meowth, and Lunala. The rest of his roster is
  // not documented in a form worth transcribing, so the regional fill completes the six.
  'protagonist gen7': { ids: [722, 52, 789], ace: 722 },
};

const failures = [];

async function wikitext(page) {
  const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return '';
  const json = await res.json();
  return json?.parse?.wikitext?.['*'] ?? '';
}

/**
 * National Dex ids of a trainer's game parties, in first-appearance order, plus the ace.
 *
 * The ace is the highest-level Pokémon of the trainer's *first* listed party — that is the
 * signature the leader is built around, and it is the one that Mega Evolves in game.
 */
function gameParty(wt, allowAdaptations = false) {
  // Anime / manga / TCG sections list different Pokémon, so games come first.
  // A few opponents only ever existed outside the games — Yellow is a manga character and
  // Looker's game parties are not in a party template — so those fall back to the wider
  // page rather than ending up with a randomly filled team.
  const cut = wt.search(/\n==\s*In the (anime|manga|TCG)/i);
  const games = !allowAdaptations && cut > 0 ? wt.slice(0, cut) : wt;

  const ids = [];
  const seen = new Set();

  let ace = 0;
  let aceLevel = -1;
  let firstPartyEnd = Infinity;

  // Everything before the second {{Party}} block is the original team.
  const parties = [...games.matchAll(/\{\{Party\b/g)];
  if (parties.length > 1) firstPartyEnd = parties[1].index;

  for (const match of games.matchAll(/\{\{Pokémon\b[\s\S]*?\}\}\s*(?=\{\{|\n)/g)) {
    const block = match[0];
    const ndex = block.match(/\|\s*ndex\s*=\s*(\d+)/);
    if (!ndex) continue;
    const id = Number(ndex[1]);
    if (!id || id > 1025) continue;

    if (match.index < firstPartyEnd) {
      const lvl = Number(block.match(/\|\s*level\s*=\s*(\d+)/)?.[1] ?? 0);
      if (lvl > aceLevel) {
        aceLevel = lvl;
        ace = id;
      }
    }

    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ids, ace: ace || ids[0] || 0 };
}

async function teamFor(pages, label) {
  const ids = [];
  const seen = new Set();
  let ace = 0;

  for (const page of pages) {
    const wt = await wikitext(page);
    if (!wt) {
      failures.push(`${label}: page "${page}" returned nothing`);
      continue;
    }
    let party = gameParty(wt);
    if (party.ids.length === 0) {
      // Nothing in the games section — take the anime/manga roster instead.
      party = gameParty(wt, true);
      if (party.ids.length) failures.push(`${label}: using anime/manga roster (no game party)`);
    }

    // The first page listed owns the ace (combined slots list the leader first).
    if (!ace && party.ace) ace = party.ace;
    for (const id of party.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    await new Promise((r) => setTimeout(r, 350)); // be polite to the wiki
  }

  if (ids.length < 6 && MANUAL_ROSTERS[label]) {
    const manual = MANUAL_ROSTERS[label];
    failures.push(`${label}: using the hand-written roster (nothing parseable on the wiki)`);
    return { ids: [...manual.ids], ace: manual.ace };
  }

  if (ids.length === 0) failures.push(`${label}: no Pokémon extracted`);
  else if (ids.length < 6) failures.push(`${label}: only ${ids.length} Pokémon (needs up to 6)`);

  return { ids, ace: ACE_OVERRIDES[label] || ace || ids[0] || 0 };
}

function fmtGrouped(entries) {
  return entries
    .map(([gen, list]) => `  ${gen}: [\n${list.map(([key, t]) => `    /* ${key} */ [${t.ids.join(', ')}],`).join('\n')}\n  ],`)
    .join('\n');
}

function fmtGroupedAces(entries) {
  return entries.map(([gen, list]) => `  ${gen}: [${list.map(([, t]) => t.ace).join(', ')}],`).join('\n');
}

async function collectGrouped(source, label) {
  const out = [];
  for (const [gen, entries] of Object.entries(source)) {
    const list = [];
    for (const [key, ...pages] of entries) {
      const team = await teamFor(pages, `${label} gen${gen} ${key}`);
      list.push([key, team]);
      process.stderr.write(`${label} gen${gen} ${key}: ${team.ids.length} (ace ${team.ace})\n`);
    }
    out.push([gen, list]);
  }
  return out;
}

async function collectFlat(source, label) {
  const out = [];
  for (const [gen, pages] of Object.entries(source)) {
    const team = await teamFor(pages, `${label} gen${gen}`);
    out.push([gen, team]);
    process.stderr.write(`${label} gen${gen}: ${team.ids.length} (ace ${team.ace})\n`);
  }
  return out;
}

const gyms = await collectGrouped(GYM_LEADERS, 'gym');
const elite = await collectGrouped(ELITE_FOUR, 'e4');
const champs = await collectFlat(CHAMPIONS, 'champion');
const villains = await collectGrouped(VILLAIN_BOSSES, 'villain');
const rivals = await collectFlat(RIVALS, 'rival');
const battleTrainers = await collectGrouped(BATTLE_TRAINERS, 'battleTrainer');
const protagonists = await collectFlat(PROTAGONISTS, 'protagonist');
const femaleProtagonists = await collectFlat(FEMALE_PROTAGONISTS, 'protagonistF');
const extras = await collectGrouped(EXTRA_FIELD_TRAINERS, 'extra');

const flat = (entries) => entries.map(([gen, t]) => `  ${gen}: [${t.ids.join(', ')}],`).join('\n');
const flatAce = (entries) => entries.map(([gen, t]) => `  ${gen}: ${t.ace},`).join('\n');

const file = `/**
 * Canonical opponent rosters, by National Dex id.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-trainer-teams.mjs
 *
 * Scraped from each trainer's Bulbapedia page in document order, which means the list
 * starts with the team they originally use in the games and continues with rematch,
 * remake and BW2 Pokémon World Tournament Pokémon. Opponents that need more slots than
 * their original team had simply take the next entries.
 */

/** Eight gym leaders per generation, in gym order. */
export const gymLeaderTeamsByGeneration: Record<number, number[][]> = {
${fmtGrouped(gyms)}
};

/** Four Elite Four members per generation, in challenge order. */
export const eliteFourTeamsByGeneration: Record<number, number[][]> = {
${fmtGrouped(elite)}
};

export const championTeamsByGeneration: Record<number, number[]> = {
${flat(champs)}
};

export const villainBossTeamsByGeneration: Record<number, number[][]> = {
${fmtGrouped(villains)}
};

export const rivalTeamsByGeneration: Record<number, number[]> = {
${flat(rivals)}
};

/** Battle Trainer encounters, one roster per trainer on the region's wheel. */
export const battleTrainerTeamsByGeneration: Record<number, number[][]> = {
${fmtGrouped(battleTrainers)}
};

/** Player characters, fielded by the World Tournament. */
export const protagonistTeamsByGeneration: Record<number, number[]> = {
${flat(protagonists)}
};

/**
 * Reserve competitors, used only to top a tournament field back up to its full size when a
 * region's scripted cast comes up short (see EXTRA_FIELD_TRAINERS in the generator).
 */
export const extraFieldTeamsByGeneration: Record<number, number[][]> = {
${fmtGrouped(extras)}
};

/**
 * Signature Pokémon — the highest-level member of each trainer's original party.
 *
 * In Type Advantage mode the opponent Mega Evolves this one when it has a Mega form, the
 * same way these trainers do in the games.
 */
export const gymLeaderAcesByGeneration: Record<number, number[]> = {
${fmtGroupedAces(gyms)}
};

export const eliteFourAcesByGeneration: Record<number, number[]> = {
${fmtGroupedAces(elite)}
};

export const championAceByGeneration: Record<number, number> = {
${flatAce(champs)}
};

export const villainBossAceByGeneration: Record<number, number[]> = {
${fmtGroupedAces(villains)}
};

export const rivalAceByGeneration: Record<number, number> = {
${flatAce(rivals)}
};

export const battleTrainerAceByGeneration: Record<number, number[]> = {
${fmtGroupedAces(battleTrainers)}
};

export const protagonistAceByGeneration: Record<number, number> = {
${flatAce(protagonists)}
};

/** The female half of each region's protagonist pair. */
export const femaleProtagonistTeamsByGeneration: Record<number, number[]> = {
${flat(femaleProtagonists)}
};

export const femaleProtagonistAceByGeneration: Record<number, number> = {
${flatAce(femaleProtagonists)}
};

export const extraFieldAceByGeneration: Record<number, number[]> = {
${fmtGroupedAces(extras)}
};
`;

await fs.writeFile('src/app/data/trainer-teams.ts', file);
console.log('wrote src/app/data/trainer-teams.ts');

if (failures.length) {
  console.log(`\n${failures.length} warning(s):`);
  for (const f of failures) console.log('  - ' + f);
}
