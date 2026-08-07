# Opponents, scaling and type effectiveness

How a scripted opponent goes from "a name in a table" to "six creatures with types and power that tilt a wheel". Read this when adding a difficulty mode, changing how bosses are built, or making matchups matter more or less.

## Contents

- [The problem this solves](#the-problem-this-solves)
- [Building an opponent squad](#building-an-opponent-squad)
- [Scaling tables](#scaling-tables)
- [Deterministic randomness](#deterministic-randomness)
- [Scoring the matchup](#scoring-the-matchup)
- [The type chart](#the-type-chart)
- [Transformations that change typing](#transformations-that-change-typing)
- [Adding a new difficulty mode](#adding-a-new-difficulty-mode)
- [Showing your work](#showing-your-work)

## The problem this solves

The original game had no opponents at all — difficulty was `currentRound`, the badge count, standing in for "the enemy got stronger". That works until you put the enemy team on screen. Then a boss fielding four fully evolved creatures and one fielding four unevolved ones produce identical odds, and the player can see it. The wheel sits at 50/50 against a squad it has no business beating.

So the enemy team system exists to make the odds **read the thing the player is looking at**. That framing is worth keeping in mind: every piece below exists to turn something visible into something the odds account for.

## Building an opponent squad

```ts
buildTeam(
  canonicalIds: number[],   // the trainer's real roster, in order
  generationId: number,     // constrains fills to that region's dex
  themeTypes: PokemonType[],// their specialty, e.g. ['rock']
  size: number,             // from the scaling table
  seedKey: string,          // 'gym:3:5' — stable identity for the RNG
  options: {
    fullyEvolved?: boolean; // push everything to final forms
    maxStage?: number;      // or cap how far evolved they may be
    allowMega?: boolean;
    aceId?: number;         // their signature creature
    preferredMegaForm?: string;
  },
): EnemyPokemon[]
```

The algorithm, and why each step is there:

1. **Walk the canonical roster**, applying the evolution adjustment to each entry.
   *Walk the whole roster, not just its first `size` entries* — evolving collapses lines onto shared final forms (two members of the same family both become the same creature), which would otherwise leave duplicate slots and a short squad.
2. **Deduplicate** as you add. Same reason.
3. **Fill from themed candidates** if still short — creatures of the trainer's specialty types from that region. Ask for ~4× the shortfall, because many candidates collapse onto forms already present.
4. **Widen to the whole region** if still short. Rare types in small early regions genuinely run out.
5. **Apply a transformation** (Mega/awakened form) if allowed, preferring the ace.

Two opposite adjustments, never both at once:

- `fullyEvolved: true` → push each entry to its final form. For late-game opponents.
- `maxStage: n` → pull entries *down* to at most stage `n`. This exists because rosters scraped from source material include rematch and remake parties, so the first boss's third slot might contain a third-stage powerhouse they only use in a postgame rematch. Without the cap, badge one is defended by an endgame creature.

That second one generalizes: **any content sourced from external data will contain entries from contexts you didn't intend.** Cap rather than trust.

## Scaling tables

Squad size is a function of *the player's own team size*, not just the rung:

```ts
const GYM_SIZE_RULES: SizeRule[][] = [
  [{ upTo: 1, size: 2 }, { upTo: Infinity, size: 3 }],           // gym 1
  [{ upTo: 1, size: 2 }, { upTo: 3, size: 3 }, { upTo: Infinity, size: 4 }],
  /* ... */
  [{ upTo: Infinity, size: 6 }],                                  // gym 8: always full
];
```

Read each row as "first threshold whose limit the player's team fits into". The asymmetry is deliberate: a player running a single creature never faces a full squad, so a self-imposed challenge run stays possible, while the last gym is always a full six regardless.

The unlock points are staggered on purpose:

```ts
export const FULLY_EVOLVED_FROM_GYM_INDEX = 3;  // 4th gym: only final forms
export const MEGA_FROM_GYM_INDEX = 4;           // 5th gym: transformations allowed
```

**Staggering matters more than the exact values.** Landing both unlocks on the same rung produces a difficulty cliff that playtesters report as "the game breaks at gym 5". If you add a third unlock (held items, weather, whatever), give it its own rung.

Note the early-game double-charge that the odds builder deliberately avoids: the size table *gives early opponents one more member than the player*, so the outnumbered penalty only counts from the second missing member onward. Otherwise the early game is taxed twice — once through the extra member's power, once through being outnumbered. If you change the size table, re-check that interaction.

## Deterministic randomness

Squad fills are seeded from a stable string:

```ts
`gym:${generationId}:${roundIndex}`
```

This is important and easy to get wrong. The same opponent must produce the same squad every time it's rebuilt — and it *is* rebuilt, on every team change, because the odds recalculate whenever the player's team changes. With `Math.random()` the enemy team would reshuffle under the player between one catch and the next, and the displayed odds would jitter for no visible reason.

**Rule: anything the player can see and re-derive must be seeded.** Anything rolled once and consumed immediately (a wheel spin) can use plain randomness.

## Scoring the matchup

```ts
scoreAdvantage(playerTeam, enemyTeam): TypeAdvantage
```

Every one of your creatures is compared against every one of theirs, in both directions:

```ts
for (const p of mine) {
  for (const enemy of theirs) {
    const off = effectivenessScore(matchupMultiplier(p.types, enemy.types));
    const def = effectivenessScore(matchupMultiplier(enemy.types, p.types));
    weighted += p.weight * off - enemy.weight * def;
  }
}
const typeScore = weighted / (mine.length * theirs.length);
```

Three design decisions worth preserving:

**Real multipliers, not a boolean.** `effectivenessScore` is `log2(multiplier)`, with immunity as `-3`. So 4× = +2, 2× = +1, neutral = 0, ½× = −1, ¼× = −2. Log scale makes the metric symmetric and additive — a dual type that resists one attack and is weak to another nets to zero, which is correct and which a yes/no "is it super effective" check gets wrong.

**Each side's power scales its own half** (`weight = power / 3`, baseline 3). Your ace converts its coverage into more; their strongest punishes your weaknesses harder than their weakest does.

**Averaged per pairing, not per unit of power.** Dividing by summed weight would cancel power straight back out, making a rookie score like an ace. This is a subtle trap — if you refactor this function, keep the divisor as `mine.length * theirs.length`.

Then it's clamped into slices:

```ts
const MAX_ADVANTAGE_SLICES = 3;   // typing tilts the wheel, it never decides it
const ADVANTAGE_SCALE = 2;        // steps of average effectiveness per slice
const OUTNUMBERED_PENALTY = 0.35; // per extra opponent

const raw = typeScore - (theirs.length - mine.length) * OUTNUMBERED_PENALTY;
const slices = clamp(Math.round(raw * ADVANTAGE_SCALE), -3, 3);
```

The cap is a values statement: **a perfect matchup should feel like a real edge, never like a guaranteed win.** Raise `MAX_ADVANTAGE_SLICES` and typing becomes the dominant mechanic; team-building stops mattering next to type-checking. Decide which game you want before touching it.

One scaling caveat: the cap is absolute while the total slice count grows through the run, so ±3 is a big deal in an early 8-slice fight and nearly noise in a 40-slice endgame fight. If players report "type advantage does nothing late", that's the cause — scale the cap with total slices rather than raising it flat.

## The type chart

Shipped locally rather than fetched:

```ts
const CHART: Record<PokemonType, Relations> = {
  normal: { notVery: ['rock', 'steel'], none: ['ghost'] },
  fire:   { super: ['grass', 'ice', 'bug', 'steel'], notVery: ['fire','water','rock','dragon'] },
  /* ...only non-neutral relations; everything omitted is 1× */
};
```

The reasoning in the source is worth repeating as a general principle: the API exposes the same data, but that's 18 extra requests before a battle can be scored, and it breaks offline. **The chart never changes, so shipping it is strictly better.** Apply the same test to any other reference data you're tempted to fetch: does it change? If not, ship it.

`matchupMultiplier(attackerTypes, defenderTypes)` multiplies across the defender's types, which is what produces 4× and ¼× naturally.

## Transformations that change typing

Temporary battle forms are the reason typing is scored on the *current* form:

```ts
playerTypes(pokemon: PokemonItem): PokemonType[] {
  if (pokemon?.isMegaEvolved && pokemon.megaFormId) {
    const megaTypes = typesForPokemonId(pokemon.megaFormId);
    if (megaTypes.length) return megaTypes;
  }
  return typesForPokemonId(pokemon.pokemonId);
}
```

That's what makes transforming a *tactical* choice rather than a flat power bump — a form change can hand you a resistance or hand the opponent a new weakness.

The bookkeeping that makes it safe:

- `megaBackup` stores the pre-transformation name, sprite and power.
- Every battle-result handler calls `revertMegaEvolution()` **first**, before any branching. Battle-only buffs that survive the battle are a classic source of runaway power creep, and putting the revert at the top of every handler makes it impossible to miss on the loss path — which is the path people forget.

## Adding a new difficulty mode

The existing two modes swap exactly one term in the odds builder and share everything else. Follow that:

1. Add the mode to the mode union and the picker component.
2. In `buildVictoryOdds`, add a branch that computes the opposing contribution differently. **Do not fork the function** — the composability of the slice model is the whole point.
3. Add any run-scoped state (lives, charges, curses) to the run service, not the state machine.
4. Gate UI on the mode with a getter (`get showLives()`), so Classic renders exactly as before. The existing getter is a good model: it hides lives in Classic, before a mode is picked, *and* during the tournament — because a tournament entrant has no lives, and showing empty hearts there would be a lie.
5. Simulate: `python scripts/odds_sim.py run --mode <yours> --trials 20000`.

Keeping the original mode byte-for-byte unchanged is what lets you ship an experimental mode without a regression risk on the mode everyone plays.

## Showing your work

`TypeAdvantage` carries readout fields that no calculation consumes:

```ts
{ covered, vulnerable, raw, slices, outnumberedBy }
```

`covered` (how many of theirs you have an answer for) and `vulnerable` (how many of yours they threaten) exist purely to *explain the number* on screen. They're a deliberate cost paid for player trust.

This is the design rule that matters most in this whole genre: **when the randomizer is visible, its inputs must be visible too.** A wheel that leans red for reasons the player can't see is the thing that generates "this game is rigged" feedback. Any new contributor to the odds needs a matching readout, or you've added an invisible tax.
