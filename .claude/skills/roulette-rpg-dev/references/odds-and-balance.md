# Odds and balance

Everything the player experiences as "difficulty", "luck" or "fairness" is decided here. This is the highest-leverage and highest-risk file in the game — a one-word change swings win rates by tens of points.

## Contents

- [The slice model](#the-slice-model)
- [The battle odds builder](#the-battle-odds-builder)
- [Why slices instead of percentages](#why-slices-instead-of-percentages)
- [Reading the difficulty curve](#reading-the-difficulty-curve)
- [Simulate before you ship](#simulate-before-you-ship)
- [The tuning levers, ranked](#the-tuning-levers-ranked)
- [Second chances vs. better odds](#second-chances-vs-better-odds)
- [Fixed-probability wheels](#fixed-probability-wheels)
- [Common balance complaints and what they actually mean](#common-balance-complaints-and-what-they-actually-mean)

## The slice model

A wheel's odds are an array of slices. Probability of an outcome = its total weight ÷ sum of all weights. Nothing else is going on.

```ts
[ {text:'yes', weight:1}, {text:'no', weight:63} ]   // 1/64 ≈ 1.6%
```

Two idioms coexist and it's worth knowing which you're looking at:

- **Weight as multiplier** — few slices, big numbers (`weight: 63`). Compact, but you must divide to understand it. Always comment the resulting probability.
- **Slices as votes** — many `weight: 1` entries pushed in a loop, one per point of some game quantity. Verbose, but it makes the *reason* for each slice legible and lets independent systems each contribute without touching a shared formula. Battle odds use this.

## The battle odds builder

Every fight in the game funnels through one function. It's worth reading in full because it's the whole combat system:

```ts
const ENEMY_POWER_WEIGHT = 0.5;   // how much of the enemy's raw power reaches the wheel

export function buildVictoryOdds(input: VictoryOddsInput): WheelItem[] {
  const odds: WheelItem[] = [{ ...YES }];              // 1 base Yes

  const playerPower = playerTeam.reduce((s, p) => s + p.power, 0);
  for (let i = 0; i < playerPower; i++) odds.push({ ...YES });    // +1 Yes per power point

  for (let i = 0; i < xAttackBonus(playerTeam, items); i++) odds.push({ ...YES });

  odds.push({ ...NO });                                 // 1 base No

  if (isTypeAdvantageMode && enemyTeam.length) {
    const enemyPower = enemyTeam.reduce((s, p) => s + p.power, 0);
    for (let i = 0; i < Math.ceil(enemyPower * ENEMY_POWER_WEIGHT); i++) odds.push({ ...NO });

    // Only past the FIRST missing member: early opponents are given one extra on purpose,
    // and charging for that gap would tax the early game twice.
    const outnumbered = Math.max(0, enemyTeam.length - playerTeam.length - 1);
    for (let i = 0; i < outnumbered; i++) odds.push({ ...NO });
  } else {
    const penalty = flatDifficulty ?? currentRound;     // Classic: 1 No per badge earned
    for (let i = 0; i < penalty; i++) odds.push({ ...NO });
  }

  const slices = typeAdvantage?.slices ?? 0;            // −3..+3, see opponents-and-scaling.md
  for (let i = 0; i < Math.abs(slices); i++) {
    odds.push(slices > 0 ? { ...YES } : { ...NO });
  }

  return odds;
}
```

Read as a sentence: **your team's total power is your offense; the opponent (or in Classic, your own badge count) is the defense; items and typing tilt the result.**

The two modes swap out one term and nothing else. That's the design worth preserving when adding a third mode: change *what counts as the opponent's strength*, don't fork the function.

### Why Classic penalizes you for your own progress

In Classic there is no modeled opponent, so `currentRound` — the number of ladder battles won — stands in for one. It creates the core tension: **every badge makes the next fight harder, so you must grow power faster than the penalty grows.** It's elegant and it's also the reason Type Advantage mode exists — the comment in the source is candid about it: a rival with four fully evolved Pokémon and one with four unevolved ones produced identical odds, because only the badge count was being read.

That's a general lesson for this genre: a difficulty proxy is fine until the game starts showing the player the thing it's proxying for. Once the enemy team is on screen, the odds have to read *that team*.

## Why slices instead of percentages

You could rewrite the above as `p = (1 + power + bonus) / (2 + power + bonus + penalty)`. Don't. The slice form:

- **Composes.** A new mechanic pushes slices; nothing else changes. A formula would need every contributor folded into it.
- **Diffs readably.** `for (...) odds.push(NO)` in a PR is obviously "harder"; a changed exponent is not.
- **Is inspectable at runtime.** You can render the actual wheel and count the red.
- **Can't silently go out of range.** No clamping bugs, no negative probabilities.

The cost is that nobody can eyeball the resulting percentage. Which is what the simulator is for.

## Reading the difficulty curve

Classic mode, assuming the player has `n` Pokémon averaging power `p` after `r` badges:

```
P(win) = (1 + n·p) / (2 + n·p + r)
```

Some real numbers:

| Badges | Team | Total power | P(win) |
|---|---|---|---|
| 0 | 1 × starter (power 1) | 1 | 2/3 ≈ 67% |
| 2 | 3 × avg 2 | 6 | 7/10 = 70% |
| 4 | 4 × avg 3 | 12 | 13/18 ≈ 72% |
| 7 | 6 × avg 4 | 24 | 25/33 ≈ 76% |
| 7 | 3 × avg 2 (neglected team) | 6 | 7/15 ≈ 47% |

The curve is **flat for a player who keeps up and punishing for one who doesn't** — exactly right for a game where catching and evolving are the only things you control. When you change any constant here, reproduce this table and check both rows: the diligent player and the neglectful one. A change that only helps one of them is usually the wrong change.

## Simulate before you ship

`scripts/odds_sim.py` models the builder exactly. Run it before and after any odds edit.

```bash
# Difficulty curve across a full Classic run
python scripts/odds_sim.py curve --mode classic

# One specific fight
python scripts/odds_sim.py fight --team 3,3,4,5 --round 5 --enemy 4,4,5,5,5,6 --type-slices -2

# Chance of clearing all 8 gyms + Elite Four + Champion, 20k simulated runs
python scripts/odds_sim.py run --mode type-advantage --lives 3 --trials 20000

# Compare a proposed change against current values
python scripts/odds_sim.py curve --mode classic --enemy-power-weight 0.65
```

Look at three things, in this order:

1. **The floor.** What's the worst realistic win rate in the run? Below ~35% players feel cheated, because a wheel makes the randomness explicit and memorable in a way hidden dice rolls don't.
2. **The shape.** Monotonic decline reads as "the game is beating me"; a flat curve with occasional spikes reads as "boss fights". Prefer the second.
3. **End-to-end completion rate.** A 75% win rate per fight sounds generous and is a **4% chance** of clearing 12 fights in a row without lives. Per-fight intuition is badly miscalibrated for runs; always check the product.

That last point is the single most common balance mistake in run-based games. Write it down before arguing about a single fight's odds.

## The tuning levers, ranked

From safest to most disruptive:

1. **Item effects** (`xAttackBonus`, potion counts). Opt-in, self-limiting, and reversible — the player chooses whether to carry them.
2. **`ENEMY_POWER_WEIGHT`** (0.5). One multiplier on the whole enemy contribution. The cleanest global difficulty knob; try ±0.15 before touching anything else.
3. **`MAX_ADVANTAGE_SLICES`** (3) **and `ADVANTAGE_SCALE`** (2). How much typing matters. Raising it rewards planning and punishes bad matchups hard; it also makes the type chart the dominant mechanic, so raise it only if that's the game you want.
4. **Enemy team sizes** (`GYM_SIZE_RULES`). Big, chunky steps — each extra opponent adds ~half its power in No slices *plus* possibly an outnumbered slice. Adjust one gym row at a time.
5. **The base slices** (one Yes, one No). These set the asymptotes. Changing them shifts every fight in the game simultaneously; treat as a last resort.
6. **The `power` values in the dex.** Affects odds, enemy scaling, type-advantage weighting and UI at once. Only change these to fix a species that's genuinely misrated.

## Second chances vs. better odds

Potions don't change probability — they buy re-spins:

```ts
case 'potion':       this.retries = 1; break;
case 'super-potion': this.retries = 2; break;
case 'hyper-potion': this.retries = 3; break;
```

On a loss, if `retries` are exhausted a potion is consumed and grants more; only when there's nothing left does the loss stand.

This is a strictly better feel than an odds boost of equal expected value, and worth reaching for when a fight tests badly: a re-spin keeps agency visible (the player *watches* the second chance happen) whereas a hidden +10% is invisible and unsatisfying. With base win rate `q`, `k` re-spins give `1 − (1−q)^(k+1)` — so a hyper potion turns a 50% fight into 94%. That's very strong; price and drop-rate accordingly.

**Lives** work the same way at run scale: 3 lives on a 12-fight ladder is roughly the difference between a 4% and a 35% completion rate. Adding lives is the gentlest possible difficulty reduction and the first thing to try when playtesters say a mode is brutal.

## Fixed-probability wheels

Some wheels don't scale with anything, and their values are deliberate genre conventions:

| Wheel | Odds | Why |
|---|---|---|
| Shiny check | 1/64 | mirrors the source games' iconic rate; rare enough to be an event, common enough to see in a run |
| Evolution check | 1 in 4 | happens after every ladder win, so ~2 evolutions across 8 gyms |
| Hub event wheel | catch = 3×, rest = 1× | catching is the only way to grow power, so it must dominate |

When changing one, work out how many times per run it's rolled and state the expected count in the commit message — that's the number the player actually experiences, and it's the number a reviewer can sanity-check. "1/64 → 1/32" means little; "≈0.4 → ≈0.8 shinies per run" means everything.

## Common balance complaints and what they actually mean

| Complaint | Usually is | Fix |
|---|---|---|
| "The wheel is rigged" | Weights, or a long unlucky streak the player remembers vividly | Show the odds in the UI; don't touch the RNG |
| "Difficulty spikes at gym 5" | A team-size rule step, or the fully-evolved/Mega unlock landing at the same gym | Stagger the unlocks by one rung |
| "The endgame is impossible" | Per-fight rate is fine; the *product* over the ladder isn't | Add lives or checkpoint the ladder, not per-fight odds |
| "Type advantage does nothing" | `MAX_ADVANTAGE_SLICES` is small relative to total slices late-game | Scale the cap with total slice count, or raise `ADVANTAGE_SCALE` |
| "Losing feels arbitrary" | No visible cause — the player can't see why the odds were bad | Show the enemy team and the advantage readout *before* the spin |

That last row is a design principle, not a bugfix: **in a game where the randomizer is on screen, the inputs to it must be on screen too.** The type-advantage readout (`covered`, `vulnerable`, `outnumberedBy`) exists purely so the wheel's tilt is explainable. Preserve that when adding any new odds contributor — a slice with no visible cause is the one that makes players feel cheated.
