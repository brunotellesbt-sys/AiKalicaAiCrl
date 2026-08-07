# Architecture: how a roulette-driven run actually works

Read this before a large refactor, or when you need to understand *why* a change in one place shows up somewhere unrelated.

## Contents

- [The data flow, end to end](#the-data-flow-end-to-end)
- [The state stack](#the-state-stack)
- [The container](#the-container)
- [The wheel](#the-wheel)
- [Run-scoped state vs. machine state](#run-scoped-state-vs-machine-state)
- [Service layer map](#service-layer-map)
- [Where to put a new piece of state](#where-to-put-a-new-piece-of-state)

## The data flow, end to end

```
GameStateService ──current state──► Container (@switch)
                                        │ renders one wheel component
                                        ▼
                              WheelComponent (canvas)
                                        │ weighted pick → animate → emit index
                                        ▼
                              Wheel host component
                                        │ translates index → domain event
                                        ▼
                              Container handler
                                        │ mutates services (team, items, badges)
                                        │ pushes 0..n next states
                                        ▼
                              GameStateService.finishCurrentState() → pop → next render
```

Every single turn of the game is that loop. There is no other control flow. Once you see it, every feature request maps onto "add a node", "change a weight", or "change a service mutation".

## The state stack

```ts
export type GameState =
  | 'game-start' | 'mode-select' | 'character-select' | 'starter-pokemon'
  | 'adventure-continues' | 'gym-battle' | 'check-evolution'
  | 'elite-four-battle' | 'champion-battle' | 'game-finish' | 'game-over'
  /* ...~40 total */;
```

The service holds `stateStack: GameState[]` plus a `BehaviorSubject` for the current state, current round, and whether a wheel is mid-spin.

**The stack is written back to front.** `initializeStates()` builds the array with the *ending* first, because `pop()` takes from the end:

```ts
this.stateStack = [
  'game-finish',        // last thing that happens
  'champion-battle',
  'elite-four-battle',
  /* ...8 × [gym-battle, buff-chance, adventure-continues]... */
  'starter-pokemon',
  'character-select',
  'mode-select',        // first thing that happens
];
```

This trips up everyone once. When adding an event, ask "what comes *after* it?" and insert *before* that entry in the array.

### The three ways to change what happens next

```ts
setNextState(s)        // push one state — it runs immediately after the current one
repeatCurrentState()   // push the current state — the player does it again
finishCurrentState()   // pop and transition; returns the new state
```

Because it's a stack, **pushing several states runs them in reverse order.** To make the player catch a Pokémon and *then* face a rival:

```ts
this.gameStateService.setNextState('battle-rival');   // pushed first  → runs second
this.gameStateService.setNextState('catch-pokemon');  // pushed second → runs first
this.finishCurrentState();
```

Getting this backwards is the second-most-common bug in this codebase. Write the pushes in reverse-reading order and comment them.

### Rebuilding mid-run

Losing deep in the endgame doesn't end the run in modes with lives — it *rebuilds* the stack from a known checkpoint:

```ts
restartEliteFourRun(): void {
  this.stateStack = [ 'game-finish', 'champion-battle', /* 4× elite four */, 'elite-four-preparation',
                      'gym-battle', 'buff-chance', 'adventure-continues' ];
}
```

Note what's *absent*: the one-off story boss and the one-off legendary. The rebuilt stack deliberately omits them. **A rebuilt stack has no memory** — that's exactly why one-off events need run-scoped boolean flags rather than relying on position in the stack.

### The round counter

A separate counter tracks "how many ladder battles have been won" and drives which opponent you face, how strong they are, and the Classic difficulty penalty. It is incremented as a **side effect** of leaving a battle state:

```ts
finishCurrentState(): GameState {
  if (['gym-battle', 'elite-four-battle', 'champion-battle'].includes(this.state.value)) {
    this.currentRound.next(this.currentRound.value + 1);
  }
  // ...pop and emit
}
```

Any handler that replays a battle must undo that bump *after* calling `finishCurrentState()`. See `pitfalls.md`.

## The container

One component owns the whole game screen. Its template is a single `@switch` over the current state:

```html
@switch (getGameState()) {
  @case ('gym-battle') {
    <app-gym-battle-roulette
      [currentRound]="leadersDefeatedAmount"
      (battleResultEvent)="gymBattleResult($event)">
    </app-gym-battle-roulette>
  }
  /* ...one case per state... */
}
```

and its class holds one handler per outcome:

```ts
gymBattleResult(result: boolean): void {
  this.revertTemporaryBuffs();          // battle-only effects end here
  if (result) {
    this.trainerService.addBadge(...);
    this.gameStateService.setNextState('check-evolution');
  } else if (this.spendLife()) {
    this.gameStateService.retryCurrentGym();
    this.finishCurrentState();
    this.gameStateService.rewindRound();  // AFTER finish — see pitfalls.md
    return;
  }
  this.finishCurrentState();
}
```

**This container is intentionally large** (it's the only place where game rules live) but it must stay *flat*: one handler per outcome, no nested game logic inside components. When it gets unwieldy, split by extracting *services* (a tournament service, an enemy-team service), not by pushing rules down into wheel components — rules in components can't be reused by the four other states that show the same wheel.

## The wheel

The reusable canvas component has a deliberately tiny API:

```ts
@Input()  items: WheelItem[] = [];   // { text, fillStyle, weight }
@Input()  fontScale = 1;             // for wheels with long labels
@Output() selectedItemEvent = new EventEmitter<number>();  // index into items
```

### The spin, in order

1. `spinWheel()` guards against re-entry while spinning and flips a global "wheel spinning" flag (used to disable UI elsewhere).
2. **The winner is chosen immediately** by cumulative-weight selection over `items`.
3. A final rotation angle is computed to land on that slice: `n` full turns + the offset to the winning arc + a random jitter *within* the slice so it doesn't always stop dead center.
4. `requestAnimationFrame` eases toward that angle (cubic ease-out over 3–5 s).
5. On completion, it emits the index.

**Consequences you must respect:**

- Changing `items` mid-spin desynchronizes the measured angles from the array. The component reads weights from the same array it measured against for exactly this reason. Never mutate the items array while `spinning` is true.
- The animation duration and rotation count are cosmetic. Making the wheel "fairer" or "more exciting" is a weights change or a slice-count change, never an animation change.
- The emitted value is an **index**, so hosts must map it back to identity (`items[i].text === 'yes'`), not hardcode index meanings.

### WheelItem and its extensions

```ts
interface WheelItem { text: string; fillStyle: string; weight: number; }

interface PokemonItem extends WheelItem {
  pokemonId: number;
  sprite: { front_default: string; front_shiny: string } | null;
  shiny: boolean;
  power: 1|2|3|4|5|6;      // the single number the whole battle model runs on
  isMegaEvolved?: boolean;  // battle-only buff
  megaBackup?: {...};       // so the buff can be reverted after the fight
}
```

The `power` field is the load-bearing abstraction of the entire game: it is the *only* stat. Every balance lever ultimately reads it. Keep it that way — adding a second stat means touching every odds builder, every scaling table and every UI readout.

## Run-scoped state vs. machine state

Three tiers, and putting something in the wrong one is a design bug:

| Tier | Lives in | Examples | Survives |
|---|---|---|---|
| Machine state | state stack | which screen is up | nothing — it *is* the position |
| Run state | run service | mode, lives left, one-off flags | stack rebuilds |
| Player state | trainer/team/items services | team, items, badges | the whole run |
| Preferences | settings service (localStorage) | dark mode, mute, skip-rolls | reloads |

The run service is small and worth copying verbatim in a new game:

```ts
@Injectable({ providedIn: 'root' })
export class RunService {
  private modeSubject$  = new BehaviorSubject<GameMode>('classic');
  private livesSubject$ = new BehaviorSubject<number>(STARTING_LIVES);
  private bossCleared = false;      // one-off guards
  private legendaryOffered = false;

  loseLife(): boolean {             // returns "run continues?"
    const remaining = Math.max(0, this.livesSubject$.value - 1);
    this.livesSubject$.next(remaining);
    return remaining > 0;
  }

  resetRun(): void {                // keeps the chosen mode on purpose
    this.livesSubject$.next(STARTING_LIVES);
    this.bossCleared = false;
    this.legendaryOffered = false;
  }
}
```

Note `resetRun()` preserves the mode — restarting shouldn't silently drop the player back to the default difficulty. Small detail, big feel difference.

## Service layer map

Each system is one injectable singleton with `BehaviorSubject`s exposed as observables. Components subscribe; they never own game data.

| Service | Owns |
|---|---|
| game-state | the stack, current state, round counter, spinning flag |
| run | mode, lives, one-off event flags |
| trainer | team, storage/bench, items, badges, trainer sprite |
| pokemon | the dex data + live sprite/type fetches from the API |
| items | item catalog and sprites |
| evolution | evolution chains and eligibility |
| enemy-team | builds opponent squads, scores type advantage |
| tournament | brackets, groups, standings (a self-contained sub-game) |
| generation | which region is selected |
| settings / dark-mode | persisted preferences |
| audio / cry | sfx and per-creature sounds with source fallbacks |
| analytics, asset-preload | telemetry, warm-up |

## Where to put a new piece of state

Ask, in order:

1. **Does the player see it as a screen?** → new game state + wheel component.
2. **Does it change between runs but not within one?** → settings service (persisted).
3. **Does it change within a run and must survive a stack rebuild?** → run service.
4. **Is it part of the player's stuff?** → trainer service.
5. **Is it derived from the above?** → a getter, not stored state. Duplicated derived state is how the UI and the odds model drift apart.
