# Component composition for game screens

## One component per mechanic/screen, composed by a container

Don't build a single component that handles "starter selection" AND "gym battle" AND "evolution" with big conditionals. Instead:

```
main-game/
  roulette-container/
    roulette-container.component.ts   # picks WHICH roulette to show based on game state
    roulettes/
      starter-roulette/
        starter-roulette.component.ts
      gym-battle-roulette/
        gym-battle-roulette.component.ts
      mega-evolution-roulette/
        mega-evolution-roulette.component.ts
```

The container subscribes to the state service and switches which child component is rendered:

```html
@switch (currentState) {
  @case ('starter-pokemon') { <app-starter-roulette (selectedStarterEvent)="onStarterChosen($event)" /> }
  @case ('gym-battle') { <app-gym-battle-roulette (selectedItemEvent)="onGymResult($event)" /> }
}
```

Each screen component:
- Takes its own inputs (`@Input()`) for the data it needs to render.
- Emits one clear output event (`@Output()`) when its mechanic completes, with the *result*, not raw indices when avoidable — let the component resolve "index 3 was picked" into "this Pokémon was picked" before emitting.
- Doesn't know what happens after it emits — the container/state service decides the next phase.

## Standalone component skeleton

```ts
@Component({
  selector: 'app-starter-roulette',
  imports: [WheelComponent, TranslatePipe], // standalone: import only what the template needs
  templateUrl: './starter-roulette.component.html',
  styleUrl: './starter-roulette.component.css'
})
export class StarterRouletteComponent implements OnInit, OnDestroy {
  @Output() selectedStarterEvent = new EventEmitter<PokemonItem>();

  private sub!: Subscription;

  constructor(private someDataService: SomeDataService) {}

  ngOnInit(): void {
    this.sub = this.someDataService.getData().subscribe(/* ... */);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onItemSelected(index: number): void {
    const resolved = this.resolveIndexToDomainObject(index);
    this.selectedStarterEvent.emit(resolved);
  }
}
```

## Reusable "primitive" game widgets

Generic mechanics (a spinning wheel, a dialog box, a progress bar) should be their own standalone component that knows nothing about the specific game's domain — it takes generic `@Input()`s (`items: WheelItem[]`, `weight`, `fillStyle`, `text`) and emits a generic index/result. Domain-specific roulette components wrap the primitive and translate domain data into the primitive's generic shape. This is what lets you reuse one `<app-wheel>` for starters, gym battles, items, and legendaries without duplicating animation code four times.

## Services organized by domain, not by type

```
services/
  audio-service/audio.service.ts
  game-state-service/game-state.service.ts
  items-service/items.service.ts
  pokemon-service/pokemon.service.ts
```

Rather than one giant `data.service.ts`. Each domain service owns its own data + a couple of methods; components inject only what they need.
