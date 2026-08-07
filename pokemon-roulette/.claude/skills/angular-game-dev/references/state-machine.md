# Game state machine pattern

For any game with phases/turns (adventure stages, battle rounds, menu → play → result), model it as a **stack-based state machine** in a service, not as booleans scattered across components.

## Shape

```ts
// game-state.ts
export type GameState =
  | 'character-select'
  | 'starter-pokemon'
  | 'gym-battle'
  | 'game-over'
  | 'game-finish';
  // ...one literal per phase
```

```ts
// game-state.service.ts
@Injectable({ providedIn: 'root' })
export class GameStateService {
  private stateStack: GameState[] = [];
  private state = new BehaviorSubject<GameState>('game-start');
  currentState = this.state.asObservable();

  constructor() {
    this.initializeStates(); // push phases in REVERSE order (last phase pushed first)
  }

  setNextState(newState: GameState): void {
    this.stateStack.push(newState);
  }

  finishCurrentState(): GameState {
    if (this.stateStack.length > 0) {
      const popped = this.stateStack.pop()!;
      this.state.next(popped);
      return popped;
    }
    return 'game-over';
  }

  repeatCurrentState(): void {
    this.stateStack.push(this.state.value);
  }
}
```

## Why a stack instead of an enum + switch

- The full sequence of the game is declared once, up front, as data (an array) — easy to read, easy to insert a new phase without touching branching logic.
- `finishCurrentState()` is the single place that advances the game; components never mutate state directly, they just call it when their mechanic is done.
- `repeatCurrentState()` lets you loop a phase (retry a battle) without special-casing.
- Side counters that change with phase transitions (round number, score) can be bumped inside `finishCurrentState()` based on which state is ending — keep that logic here, not in components.

## Consuming state in a component

```ts
export class MainGameComponent implements OnInit, OnDestroy {
  currentState!: GameState;
  private sub!: Subscription;

  constructor(private gameStateService: GameStateService) {}

  ngOnInit(): void {
    this.sub = this.gameStateService.currentState.subscribe(s => this.currentState = s);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
```

Then the template switches on `currentState` with `@switch` / `*ngSwitchCase` to show the right child component per phase.

## Common mistakes to avoid

- Storing "what screen are we on" as a `string` field on a component instead of in the service — breaks the moment two components need to react to the same transition.
- Forgetting `ngOnDestroy` unsubscribes — in a game, screens mount/unmount constantly, so this leaks fast.
- Putting business rules ("after 4 gym battles, trigger the villain boss") inside a component's click handler instead of as an entry in the state stack — the whole point of the stack is that this belongs in one array/service.
