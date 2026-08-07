# Content: regions, rosters, items, badges, sprites, audio, i18n

Most requests that sound like features are content edits. Check here before writing a component.

## Contents

- [The shape of content](#the-shape-of-content)
- [Adding a region](#adding-a-region)
- [Rosters and encounter tables](#rosters-and-encounter-tables)
- [The creature catalogue](#the-creature-catalogue)
- [Items](#items)
- [Badges and rewards](#badges-and-rewards)
- [Sprites and image fallbacks](#sprites-and-image-fallbacks)
- [Audio with source cascades](#audio-with-source-cascades)
- [Internationalisation](#internationalisation)
- [Persisted settings and save data](#persisted-settings-and-save-data)

## The shape of content

Everything is a plain exported constant keyed by region id. No database, no CMS, no runtime config:

```ts
export const gymLeadersByGeneration: Record<number, GymLeader[]> = { 1: [...], 2: [...] };
export const gymLeaderTypesByGeneration: Record<number, PokemonType[][]> = { ... };
export const gymLeaderTeamsByGeneration: Record<number, number[][]> = { ... };
export const gymLeaderAcesByGeneration: Record<number, number[]> = { ... };
```

The parallel-arrays-by-index pattern (`[regionId][rungIndex]`) is used consistently: leader, their specialty types, their roster, and their ace all live in separate records indexed the same way. It's a little error-prone by hand, so **when adding a region, add all four entries in the same edit** and count the rungs. A missing entry doesn't crash — the lookups all default (`?? []`), so you get a silently generic opponent, which is much harder to notice than an error.

That defaulting is a deliberate robustness choice worth keeping: partial data degrades to a playable generic opponent rather than a broken run. But it does mean **absence of errors is not evidence of complete data.** Verify by playing the rung, not by the build passing.

## Adding a region

1. Add the entry to the region list:
   ```ts
   { text: 'Gen 10', region: 'Somewhere', fillStyle: 'teal', id: 10, weight: 1 }
   ```
   `weight: 1` across all regions means the selection wheel is uniform. Non-uniform region weights would be a strange design choice — this is one wheel to leave alone.
2. Add the eight leaders (name, sprite, quotes) plus their types, rosters and aces.
3. Add the endgame: four elite members and a champion, each with types/rosters/aces.
4. Add the rival, the roadside trainers, the villain boss, and the starter set.
5. Add badge images and the badge data entry.
6. Add the regional dex range so the fill logic knows which creatures are native.
7. Add translation keys for every new name and quote, in every locale.

It's a big but purely mechanical edit. **Copy an existing region's entries wholesale and edit in place** rather than writing from scratch — it guarantees you hit every table, and a diff against the copied region makes review easy.

Sprites for version-dependent leaders are stored as an *array*, and the code picks one index and emits it so the badge award matches the sprite shown. If you add a variant leader, keep sprite and badge variants index-aligned or a player gets the wrong badge.

## Rosters and encounter tables

Rosters are National Dex id arrays in the order the trainer uses them:

```ts
export const gymLeaderTeamsByGeneration: Record<number, number[][]> = {
  1: [[74, 95], [120, 121], /* ... */],
};
```

Only the canonical roster is authored. The rest of the squad is filled procedurally from the theme types (see `opponents-and-scaling.md`), which is why a two-entry roster still produces a six-strong endgame squad. **Author the signature members, let the fill handle the rest** — hand-authoring 8 regions × 13 opponents × 6 slots is a maintenance sink and the fill is indistinguishable in play.

Encounter tables (`generation-encounters.ts`, `pokemon-by-generation.ts`, `cave-pokemon-by-generation.ts`, `fish-by-generation.ts`) are per-region pools for the catch wheels. Adding a themed encounter type — say a night-time pool — means a new table plus a wheel that reads it, and nothing else.

## The creature catalogue

The dex is one big array of `PokemonItem`:

```ts
{ text: 'Bulbasaur', pokemonId: 1, fillStyle: 'green', sprite: {...}, shiny: false, power: 1, weight: 1 }
```

`power` is 1–5 in the data (6 is reserved for transformed forms). The live distribution is roughly: 344 at power 1, 306 at 2, 293 at 3, 31 at 4, 110 at 5 — a long tail where most creatures are ordinary and a small set are endgame-tier.

**`power` is the only stat in the game.** Battle odds, enemy scaling, matchup weighting and the UI all read it. Changing one creature's power is a small balance edit; adding a *second* stat is a rewrite of every odds builder and scaling table. If someone asks for "speed" or "defense", first ask what it would change that `power` plus the type chart doesn't already cover — usually the honest answer is "nothing the player would feel".

Regional variants use `pokemonId` for the variant and `basePokemonId` for the species, so species-level lookups (evolution chains, transformation tables) still resolve.

## Items

A small closed union, deliberately:

```ts
export type ItemName =
  | 'potion' | 'super-potion' | 'hyper-potion'   // battle re-spins (1 / 2 / 3)
  | 'x-attack'      // adds team-average power in Yes slices
  | 'rare-candy'    // evolution
  | 'exp-share'     // extra evolution credit
  | 'running-shoes' // re-spin the exploration wheel once per segment
  | 'escape-rope';  // skip an encounter
```

Note the two distinct verbs: **potions buy retries, X Attack buys odds.** Retries feel better (the player watches the second chance) and are the safer lever. See `odds-and-balance.md`.

To add an item:

1. Add to the union, the catalogue with its sprite, and the reward wheel.
2. Implement the effect where it applies — `xAttackBonus()` in the odds builder for odds effects, the relevant handler for flow effects.
3. **If it re-spins or repeats a state, add a latch flag reset by the handler that leaves the encounter.** No latch = infinite loop. This is the single most common bug when adding items.
4. Add its name/description keys to every locale.

## Badges and rewards

Badges are awarded only from the gym handler, with an explicit guard:

```ts
if (this.currentGameState === 'gym-battle') {
  this.trainerService.addBadge(this.leadersDefeatedAmount, this.fromLeader);
}
```

The guard exists because the same handler is reachable from non-gym contexts. Defensive checks like this are worth keeping when a handler is shared — the alternative is a player collecting badges from roadside fights.

Badge images live under `assets/badges/gen<N>/`. There's a download-and-postprocess script wired into `prebuild`, so badge assets are reproducible rather than hand-committed — worth preserving if you add regions.

## Sprites and image fallbacks

Sprites are fetched live from a public API, with a fallback chain inside the fetch itself:

```
official artwork → regular front sprite → shiny falls back to non-shiny → ''
```

Some forms genuinely lack shiny artwork, so the last step prevents a broken image on an otherwise valid creature.

On top of that, **every `<img>` bound to an external or computed URL uses the fallback directive**, not a bare tag:

```html
<img [src]="pokemon.sprite.front_default" appImgFallback />
```

Dev testing hits the popular creatures whose assets always exist; production hits every obscure regional form. A bare `<img>` there ships a broken-image icon. This is not optional polish — it's the difference between a rare 404 and a visibly broken game.

## Audio with source cascades

Sound effects are static files. Creature cries use an ordered cascade, because no single source has everything:

```
custom override JSON → local files → primary CDN (OGG) → mirror (base species)
```

Two patterns worth copying:

- **A local override file checked first**, so new or DLC content can be added without code changes.
- **A base-species fallback**, so a transformed form with no audio of its own falls back to the original rather than playing silence.

Playback should be awaited where the game waits on it (the transformation animation holds until the cry finishes) and must fail silently — audio errors should never block the run.

## Internationalisation

Nested JSON per locale in `public/i18n/`, currently EN / ES / FR / PT-BR:

```json
{ "game": { "main": { "roulette": { "shiny": { "title": "Is it shiny?" } } } } }
```

Referenced as `'game.main.roulette.shiny.title' | translate`.

Two performance notes specific to wheels: the wheel component **preprocesses translations when items change**, not per animation frame — calling `instant()` inside a `requestAnimationFrame` loop is a real frame-rate problem at 60fps. And it uses `translateService.get()` (not `instant()`) so it doesn't render before the locale file has loaded.

Wheel slice labels go through the same pipe, so slice `text` should be a translation key rather than a display string. There's a fallback to the raw text when a key doesn't resolve, which is forgiving but means **a missing key looks like a working feature during development** and shows a dotted path to players. Add keys to all locales in the same commit.

## Persisted settings and save data

Settings are a `BehaviorSubject` seeded from `localStorage` on construction, written back on change:

```ts
private readonly STORAGE_KEY = 'game-settings';

private load(): GameSettings {
  const raw = localStorage.getItem(this.STORAGE_KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };   // spread DEFAULTS first
  } catch {
    console.warn('Invalid settings in localStorage:', raw);
    return DEFAULTS;
  }
}
```

Three things to preserve when adding a setting:

- **Spread the defaults first.** A player with an older stored object is missing your new key; without the spread they get `undefined` and a subtly broken toggle.
- **Wrap the parse in try/catch.** Corrupted storage should reset to defaults, never white-screen the game.
- **Never read or write `localStorage` from a component.** One service owns it; components subscribe. Ad hoc access is how two parts of the UI end up disagreeing about the same setting.

Settings can also short-circuit game flow — for example a "skip the shiny roll" option resolves the roll in `ngOnInit` and emits immediately instead of rendering a wheel. That's a good pattern for optional ceremony: keep the *outcome* identical and skip only the presentation, so a setting never changes the game's odds.
