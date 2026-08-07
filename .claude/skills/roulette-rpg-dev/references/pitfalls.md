# Pitfalls: the bugs this architecture actually produces

Every entry below is a real bug class, most of them still commented in the source because they were painful enough to warrant a warning. Read this when debugging something that "worked and then broke", or when reviewing a diff in a game of this kind.

## Contents

- [Ordering bugs](#ordering-bugs)
- [State machine bugs](#state-machine-bugs)
- [Index bugs](#index-bugs)
- [Lifecycle bugs](#lifecycle-bugs)
- [Data bugs](#data-bugs)
- [Odds bugs](#odds-bugs)
- [Symptom → cause lookup](#symptom--cause-lookup)

## Ordering bugs

### Rewinding a counter before the thing that advances it

The worst one, and the reason it's first. Leaving a battle state increments the round counter *inside* `finishCurrentState()`. A handler that replays the same battle must undo that bump **after**:

```ts
// CORRECT
this.finishCurrentState();        // pops, and bumps the round on the way out
this.gameStateService.rewindRound();
```

```ts
// WRONG — the clamp at zero swallows it and the player advances anyway
this.gameStateService.rewindRound();
this.finishCurrentState();
```

The source comment on this is blunt: *"losing to the first leader sent you to the second one."* The player loses, is told they'll retry, and faces the next opponent — while the badge they were fighting for is silently skipped.

**The general rule:** when a function has a side effect on shared state, any compensating call belongs after it. If you can't tell whether something has a side effect, read it — don't assume from the name. `finishCurrentState()` does not sound like it mutates a counter.

### Pushing states in reading order

The stack is LIFO, so pushes run in reverse:

```ts
// Player catches, THEN battles the rival:
this.gameStateService.setNextState('battle-rival');   // pushed first  → runs SECOND
this.gameStateService.setNextState('catch-pokemon');  // pushed second → runs FIRST
```

Write these bottom-up and comment the intended play order in words. The source does exactly this for the tournament flow — *"LIFO, so the prep wheel is pushed last and therefore runs first: the player fills six slots before seeing the draw."* Without that comment the code is genuinely unreadable.

### Reverting battle-only buffs on only the win path

Every battle handler calls `revertMegaEvolution()` as its **first** statement, before any branching. Putting it inside the `if (result)` branch means a loss leaves the transformation active — permanent power creep triggered only by losing, which is both a balance bug and nearly impossible to reproduce deliberately.

Put teardown at the top of the handler, not in a branch.

## State machine bugs

### Relying on stack position for one-off events

```ts
// WRONG — a rebuilt stack has no memory
if (!this.stateStack.includes('legendary-encounter')) { ... }

// CORRECT
if (!this.runService.hasBeenOfferedLegendary) { ... }
```

Losing in the endgame rebuilds the stack from a checkpoint. Anything that should happen at most once per run needs a run-scoped boolean, set the moment the event fires.

### Forgetting the round counter after a stack rebuild

The counter keeps climbing through the endgame (8, 9, 10…). A rebuild that resumes at the last gym must force it back:

```ts
this.gameStateService.restartEliteFourRun();
this.finishCurrentState();
this.gameStateService.setRound(LAST_GYM_INDEX);   // or the replayed gym looks up index 11
```

Symptom: an out-of-range opponent lookup, so the screen renders a blank or undefined opponent.

### A state with no switch case

Adding a state name and stack entry without the container `@case` renders **an empty screen with no console error**. The run appears frozen. This is the single most common "the game is broken" report; check the switch first.

### Re-spin effects without a latch

```ts
if (this.trainerService.hasItem('running-shoes') && !this.runningShoesUsed) {
  this.runningShoesUsed = true;                              // required
  this.gameStateService.setNextState('adventure-continues');
}
```

No latch = infinite loop, and the reset (`runningShoesUsed = false`) must live in the handler that *leaves* the encounter — typically the battle-result handler. Forgetting the reset gives the item one use per run instead of one per segment, which reads as "the item stopped working".

### Dead-end states with no exit

A wheel built from a filtered list can legitimately be empty (nobody is eligible to evolve). A zero-slice wheel divides by zero computing arc size. Always handle the empty case *before* rendering, and give it a real exit — the existing code awards a consolation prize, which is better than a silent skip because the player sees that something happened.

## Index bugs

### Branching on wheel index instead of identity

```ts
// WRONG — breaks the moment anyone reorders the wheel or adds a conditional slice
if (index === 0) { win(); }

// CORRECT
if (this.odds[index].text === 'yes') { win(); }
```

Reordering slices for visual balance is a cosmetic change that a reviewer will wave through. If logic reads indices, it silently reassigns outcomes.

### Inserting into an action wheel mid-array

Hub wheels pair an array with an index→event switch. Inserting a slice in the middle shifts every case below it. **Append at the end**, or refactor so each item carries its own handler.

### Mutating the items array while spinning

The wheel measures its angles against `items` when the spin starts. Changing the array mid-spin desynchronizes the animation from the sliced-out winner, and the pointer lands on the wrong label. The component deliberately reads weights from the same array it measured — don't "optimize" that to read from a fresher source.

### Variant sprites and rewards drifting apart

Version-dependent opponents store sprites as an array; the code picks an index and emits it so the reward lookup uses the *same* index. Adding a sprite variant without a matching reward variant hands out the wrong badge.

## Lifecycle bugs

### Unsubscribed observables

These screens mount and unmount every few seconds for an entire run, so leaks compound fast. Every `subscribe()` in `ngOnInit` needs an `unsubscribe()` in `ngOnDestroy`; same for `window.addEventListener` and its `removeEventListener`.

Symptom: the game gets progressively slower over a long run, and a single wheel spin fires a handler several times because three dead component instances are still listening.

### Recalculation loops

Odds recalculate when the team changes; the team can change as a result of an outcome. If a recalculation path can mutate the team, you have a loop. Keep odds builders **pure** — they read state and return slices, they never write.

### Canvas sizing on resize only

Wheel dimensions are computed from viewport size, clamped between a min and max. Compute them on init *and* on resize, and redraw at the current rotation rather than resetting to zero — otherwise rotating a phone mid-spin visibly snaps the wheel back to its starting angle.

## Data bugs

### Silent defaulting hides missing content

Lookups default (`?? []`) throughout, so a missing roster produces a generic opponent instead of an error. Robust in production, dangerous in development: **the build passing is not evidence your data is complete.** Verify new content by playing the rung.

### Evolution collapsing a roster

Pushing entries to final forms collapses evolutionary lines onto shared forms, producing duplicates and a short squad. Walk the *whole* roster and deduplicate rather than taking the first `size` entries.

### Externally sourced rosters contain the wrong context

Scraped rosters pick up rematch and postgame parties, so an early opponent's third slot may hold an endgame creature. That's what `maxStage` is for. Cap rather than trust any imported data.

### Unseeded enemy generation

Enemy squads rebuild whenever the player's team changes. With `Math.random()` the opponent reshuffles between one catch and the next and the displayed odds jitter for no visible reason. Seed anything the player can see and re-derive.

### Missing translation keys look fine locally

The wheel falls back to raw text when a key doesn't resolve, so an untranslated slice works in development and shows a dotted path to players in other locales. Add keys to every locale in the same commit.

### Persisted settings without default spreading

```ts
return { ...DEFAULTS, ...JSON.parse(raw) };   // not just JSON.parse(raw)
```

Returning stored data directly gives returning players `undefined` for any newly added setting.

## Odds bugs

### Tuning on a single fight

A change that looks small on one encounter compounds across a 13-rung ladder. Run `scripts/odds_sim.py curve` and `run`, and look at the completion rate, not the per-fight number.

### Double-charging for the same thing

The size table gives early opponents one extra member on purpose, so the outnumbered penalty deliberately starts from the *second* missing member:

```ts
const outnumbered = Math.max(0, enemyTeam.length - playerTeam.length - 1);
```

Drop the `- 1` and the early game is taxed twice — once through the extra member's power, once through being outnumbered. Whenever you add a penalty, check whether an existing term already accounts for it.

### A cap that stops mattering

`MAX_ADVANTAGE_SLICES` is absolute while total slice count grows through the run, so ±3 is decisive early and negligible late. If type advantage "does nothing" in the endgame, scale the cap with the total rather than raising it flat.

### Averaging away the thing you just added

In the matchup score, dividing by summed power weight instead of pairing count cancels power straight back out, so a rookie scores like an ace. When you add a weighting factor, check the divisor doesn't undo it.

## Symptom → cause lookup

| Symptom | Look at |
|---|---|
| Blank screen, run appears frozen | missing `@case` in the container switch |
| Wrong opponent after a loss | `rewindRound()` called before `finishCurrentState()` |
| Events happen in the wrong order | pushes written in reading order instead of reverse |
| A one-off event happens twice | guarded by stack position instead of a run flag |
| Infinite loop on an item | re-spin without a latch, or latch never reset |
| Enemy team reshuffles for no reason | unseeded squad generation |
| Odds jitter between spins | same as above, or an impure odds builder |
| Handler fires multiple times per spin | leaked subscriptions from destroyed components |
| Broken image icons in production | `<img>` without the fallback directive |
| A dotted key path on screen | translation key missing from that locale |
| Setting silently ignored for old players | stored settings not spread over defaults |
| Difficulty cliff at one rung | two unlocks landing on the same rung |
| "Type advantage does nothing" late | absolute slice cap vs. growing slice count |
| Buff persists after a battle | revert placed inside the win branch |
| Crash computing arc size | zero-slice wheel from an empty filtered list |
