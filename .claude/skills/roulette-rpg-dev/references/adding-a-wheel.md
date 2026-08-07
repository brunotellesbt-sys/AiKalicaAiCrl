# Adding a wheel, an event, or a game state

The single most common change to a game of this kind. There are three sizes of it — figure out which one you actually need before writing any code, because the small ones are minutes and the large one is an hour.

## Contents

- [Pick the smallest version that works](#pick-the-smallest-version-that-works)
- [Recipe A: new outcome on an existing wheel](#recipe-a-new-outcome-on-an-existing-wheel)
- [Recipe B: full new state + wheel](#recipe-b-full-new-state--wheel)
- [Recipe C: multi-step sequences](#recipe-c-multi-step-sequences)
- [Conditional and repeatable events](#conditional-and-repeatable-events)
- [Wheels that aren't yes/no](#wheels-that-arent-yesno)
- [Verifying it works](#verifying-it-works)

## Pick the smallest version that works

| Ask | Size | What it touches |
|---|---|---|
| "Add a 'find a berry' outcome to the exploration wheel" | **A** | one array + one switch case + i18n |
| "Add a fishing minigame" | **B** | new component, state name, stack, container, handlers, i18n |
| "After beating the boss, let the player evolve then face a legendary" | **C** | just handler pushes — usually zero new components |

People routinely ask for B when A does the job, and implement C as a brand new screen when it's really two existing states pushed in the right order. Check the existing state list first: there are typically 30–40 states and a near-match usually exists.

## Recipe A: new outcome on an existing wheel

The hub wheel is just an array plus an index→event switch:

```ts
actions: WheelItem[] = [
  { text: 'Catch a Pokémon', fillStyle: 'crimson',   weight: 3 },  // 3× more likely
  { text: 'Battle Trainer',  fillStyle: 'darkorange', weight: 1 },
  /* ... */
];

onItemSelected(index: number): void {
  switch (index) {
    case 0: this.catchPokemonEvent.emit(); break;
    case 1: this.battleTrainerEvent.emit(); break;
    /* ... */
  }
}
```

Steps:

1. Push the new slice onto `actions`. **Append at the end** — inserting in the middle shifts every index below it and silently reassigns outcomes.
2. Add its `case` to the switch and declare a matching `@Output()`.
3. Wire the output in the container template to a handler.
4. Add the handler: mutate services, push the next state(s), `finishCurrentState()`.
5. Add the label key to **every** locale file.
6. Sanity-check the odds shift: adding a slice dilutes every existing one. A 17-slice wheel where each `weight: 1` slice was 5.9% drops to 5.6% — usually fine, but if the wheel is a reward table, re-run the simulator.

> **Better than appending:** if you find yourself maintaining parallel `actions` / `switch` arms, refactor to carry the handler on the item itself (`{ text, fillStyle, weight, emit: () => this.fooEvent.emit() }`). Index drift stops being possible. Worth doing the first time you add to a wheel that already has more than ~10 slices.

## Recipe B: full new state + wheel

Five files, always in this order — each step depends on the previous one existing.

### 1. Declare the state

```ts
export type GameState =
  | /* ...existing... */
  | 'treasure-hunt';   // new
```

### 2. Put it in the run

Remember the stack is **written back to front**. To make it happen right before each gym battle:

```ts
this.stateStack = [
  'game-finish',
  /* ... */
  'gym-battle',
  'treasure-hunt',   // runs BEFORE the gym: popped first
  'adventure-continues',
  /* ... */
];
```

Or don't touch the stack at all and have a handler push it dynamically — better for optional/random events, since it keeps the baseline run readable.

### 3. Write the component

Mirror the simplest existing wheel. The canonical shape:

```ts
@Component({
  selector: 'app-treasure-hunt-roulette',
  imports: [WheelComponent, TranslatePipe],
  templateUrl: './treasure-hunt-roulette.component.html',
  styleUrl: './treasure-hunt-roulette.component.css',
})
export class TreasureHuntRouletteComponent {
  @Output() treasureFoundEvent = new EventEmitter<boolean>();

  /** 1 in 4 — generous enough to feel worth spinning, rare enough to matter. */
  odds: WheelItem[] = [
    { text: 'yes', fillStyle: 'green',   weight: 1 },
    { text: 'no',  fillStyle: 'crimson', weight: 3 },
  ];

  onItemSelected(index: number): void {
    this.treasureFoundEvent.emit(this.odds[index].text === 'yes');
  }
}
```

```html
<div>
  <h1 class="title">{{ 'game.main.roulette.treasureHunt.title' | translate }}</h1>
  <app-wheel [items]="odds" (selectedItemEvent)="onItemSelected($event)"></app-wheel>
</div>
```

Three things to copy exactly, because they're easy to miss:

- **Branch on identity, not index** (`odds[index].text === 'yes'`). Indices move; text doesn't.
- **Comment the intended probability** next to the weights. `weight: 63` is meaningless until someone works out it's 1/64.
- **Anything subscribed in `ngOnInit` is unsubscribed in `ngOnDestroy`.** These screens mount and unmount every few seconds.

If the component needs current game data (team, region, round), inject the service and subscribe — don't thread it through five `@Input()`s.

### 4. Wire the container

Template:

```html
@case ('treasure-hunt') {
  <app-treasure-hunt-roulette (treasureFoundEvent)="treasureHuntResult($event)">
  </app-treasure-hunt-roulette>
}
```

Class:

```ts
treasureHuntResult(found: boolean): void {
  if (found) {
    this.trainerService.addItem('rare-candy');
    this.playItemFoundAudio();
  }
  this.finishCurrentState();
}
```

**A missing switch case renders an empty screen with no error** — the run appears to freeze. If you ever see that symptom, this is the cause 90% of the time.

### 5. Translations

Add to every locale, same nested path:

```json
{ "game": { "main": { "roulette": { "treasureHunt": {
  "title": "Search for treasure?"
} } } } }
```

Missing keys render as the literal dotted path on screen. Placeholder English in the other locales beats a missing key.

## Recipe C: multi-step sequences

No new components — just pushes, in reverse order. "Beat the boss → evolve someone → face the legendary":

```ts
bossDefeated(): void {
  this.runService.markBossCleared();       // one-off guard, not stack position
  this.runService.markLegendaryOffered();

  this.gameStateService.setNextState('legendary-encounter'); // pushed first → runs LAST
  this.chooseWhoWillEvolve('boss');                          // routes to evolution now
}
```

Read the pushes bottom-up to get play order. Always leave a comment saying the intended order in words — this is unreadable otherwise, and it is where sequencing bugs hide.

## Conditional and repeatable events

**Repeat the current state** (an item that grants a re-spin):

```ts
if (this.trainerService.hasItem('running-shoes') && !this.runningShoesUsed) {
  this.runningShoesUsed = true;              // latch, or it loops forever
  this.gameStateService.setNextState('adventure-continues');
}
```

The latch is mandatory. Any "re-spin" effect without a per-visit reset flag is an infinite loop, and the reset belongs in the handler that *leaves* the encounter (typically the battle-result handler).

**Skip a state that has no valid content** — e.g. a buff wheel when nobody on the team can use the buff. Handle it by checking eligibility as you enter and immediately finishing if empty, rather than by conditionally omitting it from the stack; the stack is rebuilt in places and conditional entries won't survive that.

**Guard one-off events with a run flag:**

```ts
if (!this.runService.hasBeenOfferedLegendary) {
  this.gameStateService.setNextState('legendary-encounter');
}
```

Never `stateStack.includes('legendary-encounter')`. After a rebuild that check is wrong.

## Wheels that aren't yes/no

- **Pick from a dynamic list** (which team member evolves): build the items array from live data in `ngOnInit`, and handle the empty case *before* rendering — a zero-slice wheel divides by zero on arc size. Existing code awards a consolation prize instead, which is a good pattern: a dead-end state should always have an exit.
- **Reward tables**: slices are the reward objects themselves. Keep `weight` as the rarity dial and don't encode rarity in duplicate slices — a 40-slice wheel is illegible on mobile.
- **Nested wheels** (spin to pick a category, spin again within it): model as two states, not one component with internal phases. Two states are inspectable, resumable and testable; internal phases are none of those.

## Verifying it works

Trace the chain end to end and confirm each link exists — a break anywhere shows up as a blank screen, not an error:

```
state name in union → entry in stack (or a push) → @case in container
→ component renders → wheel emits index → host maps to event
→ container handler runs → services mutated → next state pushed → finishCurrentState()
```

Then play it, including the failure path. Explicitly ask: **what happens here if the player loses, or has an empty team, or has no items?** Those branches are the least exercised and the most likely to be broken by a new state.
