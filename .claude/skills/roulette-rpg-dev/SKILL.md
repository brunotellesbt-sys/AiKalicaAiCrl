---
name: roulette-rpg-dev
description: Deep working knowledge for building, modifying and balancing roulette/wheel-driven adventure RPGs — games where a spinning wheel decides every outcome (what you catch, whether it's shiny, whether you win the battle) and a state machine drives the run from start to credits. Covers adding new wheels and game states, tuning win probabilities and difficulty curves, building scaled enemy teams with type effectiveness, adding regions/rosters/items/badges, sprite and audio fallbacks, and i18n. Use this skill whenever the user wants to change, extend, balance, debug or add content to a game of this kind — including any mention of "roleta", roulette, spin wheel, wheel of fortune, prize wheel, gacha odds, drop rates, win chance, difficulty curve, run/roguelite progression, battle odds, gym/boss ladder, enemy team scaling, type advantage, or "add a new event/encounter/screen to the game". Reach for it even when the user only says something vague like "make the game harder", "add a new event", "the fights feel unfair", or "add another region" — the odds model and the state stack are where almost all of those changes actually land.
---

# Roulette-Driven Adventure RPGs

Games in this family look simple — click a wheel, watch it spin — but they are really **two systems in a trenchcoat**: a probability model that decides outcomes, and a state machine that decides which decision comes next. Almost every change a user asks for lands in one of those two places. Get the mental model right and the edits become small and safe; get it wrong and you produce the classic bugs listed in `references/pitfalls.md`.

This skill is grounded in a real, shipped Angular game (a Pokémon-themed roulette adventure: 9 regions, 34 wheel components, two difficulty modes, a post-game tournament). The patterns generalize to any wheel-driven run-based game in any framework — the file names below are that game's, the reasoning is not.

## The mental model: four pillars

**1. The wheel is a renderer, not a decider.**
Weighted random selection picks the winning index *first*; only then does the code compute a final rotation angle that lands the pointer on that slice. The 3–5 second animation is pure theater. This matters enormously: **to change what happens in the game you change weights, never animation code.** If someone reports "the wheel feels rigged," they are describing weights, not the spin.

**2. Outcomes are bags of slices, not percentages.**
Odds are built by *pushing* slices onto an array: "one Yes for the base, one Yes per point of team power, one No per badge earned." Nobody writes `0.62`. This is deliberate — additive slices compose cleanly (a type advantage and an item bonus just both push slices, no formula rewrite), stay readable in a diff, and are trivially inspectable. Preserve this style when you extend it. See `references/odds-and-balance.md`.

**3. The run is a LIFO stack of states, not a linear script.**
The whole adventure is one pre-built array of state names that gets popped one at a time. Because it's a stack, the array is written **back to front** — the ending sits at index 0. The payoff is that any handler can *inject* future events by pushing: losing a boss fight pushes `[run-up, buff-chance, boss]` and the player replays that stretch. See `references/architecture.md`.

**4. Content is data, code is generic.**
Regions, rosters, badges, items, encounter tables and type charts are plain exported arrays/records keyed by region id. Adding a region is a data edit; adding a *kind of event* is a code edit. Always check whether the ask is data before you write code. See `references/content-and-data.md`.

## Route the request

Read the reference file that matches what's being asked. Don't read all of them — each is self-contained.

| The user wants to… | Read |
|---|---|
| Add a new event, encounter, screen or wheel; change the order of the run; make an event repeat or be skippable | `references/adding-a-wheel.md` |
| Make the game harder/easier/fairer; change drop rates, shiny odds, win chance; add an item that affects battles; diagnose "the difficulty spikes" | `references/odds-and-balance.md` |
| Change how opponents are built or scale; add type effectiveness; give bosses better teams; add a new difficulty mode | `references/opponents-and-scaling.md` |
| Add a region/generation, roster, item, badge, sprite set, or a new language | `references/content-and-data.md` |
| Understand the whole engine before a large refactor | `references/architecture.md` |
| Debug something that "worked, then broke"; review a diff in this codebase | `references/pitfalls.md` |

There is also a balance simulator at `scripts/odds_sim.py` — run it *before* shipping any odds change so you tune against numbers instead of vibes. Details in `references/odds-and-balance.md`.

## Invariants worth protecting

These are not style preferences. Each one exists because breaking it produced a real, shipped bug.

**Never let a wheel's visual slice order drive game logic.** Handlers should branch on the item's identity (`items[index].text === 'yes'`), not on the raw index. Indices shift the moment someone reorders a wheel for aesthetics or a conditional slice appears, and index-based branching silently reassigns outcomes.

**A state's side effects belong to the handler, not the component.** The wheel component emits "slice 3 was chosen"; the container decides that means "award a badge, then queue the evolution check." Keeping components dumb is what lets the same wheel be reused by four different states.

**Order matters when you push and pop in the same handler.** Leaving a battle state advances the round counter as a side effect, so a handler that both finishes a state and rewinds the counter must rewind *after* finishing. The reverse order gets swallowed by the clamp at zero and the player advances to the wrong opponent. This class of bug is the single most common one in this codebase — `references/pitfalls.md` catalogs the rest.

**One-off events need a run-scoped flag, not a state-machine position.** Anything that must happen at most once per run (a story boss, a legendary offer) sets a boolean on the run service. Rebuilding the state stack after a loss will otherwise replay it, because the stack has no memory of what already happened.

**Every externally-sourced `<img>` needs an error fallback.** Sprites come from a live API and CDN; 404s on obscure forms are routine in production and invisible in dev. A bare `<img>` there ships a broken-image icon to players.

**User-facing strings go through the translation pipe, and every key is added to every language file.** A missing key renders as the raw dotted path in the UI. When you add a wheel, add its keys to *all* locales in the same commit — even if the translation is just the English text as a placeholder.

## Working method

1. **Classify the ask first: data, weights, or flow?** Most requests that sound like features ("add a new region", "make bosses tougher") are data or weight edits. Only a genuinely new *kind* of interaction needs a new component and state.
2. **Find the closest existing example and mirror it.** These codebases are highly repetitive by design — there are usually 20 near-identical wheels. Copying the nearest sibling gets the wiring, cleanup and i18n structure right for free, and keeps the diff reviewable.
3. **Trace the full path before editing.** For a wheel: state name → container switch case → component → wheel → emit → handler → next state. Skipping a link is how you get a state that renders nothing and a run that appears to freeze.
4. **Simulate odds changes; don't eyeball them.** A change that looks small ("one more No per badge") can swing the 8th-gym win rate by 20 points. Run `scripts/odds_sim.py` and look at the curve across the whole run, not one fight.
5. **Check the ending path.** Many changes to mid-run flow accidentally break loss/retry/game-over routing, which is the least-played and least-tested path. Ask explicitly: what happens here if the player *loses*?

## Before you call it done

- [ ] New state added to the state-name union, the stack, **and** the container's switch — all three, or the screen renders blank.
- [ ] Handler routes both outcomes: win *and* lose (and retry, if the mode has lives).
- [ ] Odds change simulated across the full run, not a single encounter.
- [ ] Weights are integers with a comment explaining the intended probability, so the next reader doesn't have to divide by the total to understand it.
- [ ] Subscriptions and event listeners unsubscribed/removed on destroy — these screens mount and unmount constantly, so leaks compound.
- [ ] Translation keys added to every locale file.
- [ ] External images have a fallback directive; new audio has a source cascade.
- [ ] One-off events guarded by a run flag, not by stack position.
- [ ] Existing saved runs / persisted settings still load (schema changes need a default or a migration).
