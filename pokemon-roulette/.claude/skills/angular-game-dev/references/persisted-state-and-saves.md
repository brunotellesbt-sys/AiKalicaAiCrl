# Persisted state (settings & save data)

Any state that should survive a page reload — settings, mute toggles, and (if the game has one) save/progress data — follows the same shape: a `BehaviorSubject` seeded from `localStorage` on construction, written back to `localStorage` on every change, exposed as a `distinctUntilChanged()` observable.

## The canonical pattern

```ts
export interface GameSettings {
  muteAudio: boolean;
  skipShinyRolls: boolean;
  lessExplanations: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'pokemon-roulette-settings';
  private readonly defaultSettings: GameSettings = {
    muteAudio: false,
    skipShinyRolls: false,
    lessExplanations: false
  };

  private settingsSubject$: BehaviorSubject<GameSettings>;

  constructor() {
    this.settingsSubject$ = new BehaviorSubject(this.getInitialSettings());
  }

  get settings$(): Observable<GameSettings> {
    return this.settingsSubject$.asObservable().pipe(distinctUntilChanged());
  }

  get currentSettings(): GameSettings {
    return this.settingsSubject$.getValue();
  }

  toggleMuteAudio(): void {
    this.updateSettings({ ...this.currentSettings, muteAudio: !this.currentSettings.muteAudio });
  }

  resetSettings(): void {
    this.updateSettings(this.defaultSettings);
  }

  private updateSettings(newSettings: GameSettings): void {
    this.saveSettingsToStorage(newSettings);
    this.settingsSubject$.next(newSettings);
  }

  private getInitialSettings(): GameSettings {
    return { ...this.defaultSettings, ...(this.getSettingsFromStorage() ?? {}) };
  }

  private saveSettingsToStorage(settings: GameSettings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }

  private getSettingsFromStorage(): Partial<GameSettings> | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      console.error('Invalid settings in localStorage, falling back to defaults');
      return null;
    }
  }
}
```

Why each piece matters:
- **One `STORAGE_KEY` constant per service** — namespaced (`'pokemon-roulette-settings'`, not `'settings'`) so it doesn't collide with other apps on the same origin or other persisted slices in the same app.
- **`getInitialSettings()` merges stored data over defaults**, not the other way around — so adding a new field to `GameSettings` later doesn't break existing saves; old localStorage data just won't have the new key, and the spread fills it in from `defaultSettings`.
- **`distinctUntilChanged()`** on the public observable — prevents re-renders/re-subscriptions firing when something writes the same value back.
- **try/catch around `JSON.parse`** — a corrupted or manually-edited localStorage value must never crash the app on boot; fall back to defaults and log it.
- **Immutable updates** (`{ ...current, field: newValue }`) so `distinctUntilChanged` (which does reference equality by default on objects — but here each update produces a genuinely new value) and change detection behave predictably.

## Cross-cutting settings: inject, don't duplicate

A service that needs to *respect* a setting (e.g. audio playback checking mute) should inject the settings service rather than re-reading localStorage itself:

```ts
@Injectable({ providedIn: 'root' })
export class AudioService {
  constructor(private settingsService: SettingsService) {}

  playAudio(audio: HTMLAudioElement, volume: number = 1.0): void {
    const isMuted = this.settingsService.currentSettings.muteAudio;
    audio.volume = isMuted ? 0 : volume;
    audio.paused ? audio.play() : (audio.currentTime = 0, audio.play());
  }

  get isMuted$(): Observable<boolean> {
    return this.settingsService.settings$.pipe(map(s => s.muteAudio));
  }
}
```

This keeps the mute flag as a single source of truth. If five different services each read their own copy of `localStorage`, they can drift out of sync with each other and with the UI.

## Extending this to full save/progress data

The pattern above only persists *settings*. If the game needs actual save/resume (not just preferences) — e.g. resuming mid-adventure — extend the *same* service shape to the state-machine service itself (see `references/state-machine.md`):

```ts
export class GameStateService {
  private readonly SAVE_KEY = 'my-game-save-v1';

  constructor() {
    const saved = this.loadSave();
    this.stateStack = saved?.stateStack ?? this.defaultStateStack();
    this.state = new BehaviorSubject<GameState>(saved?.currentState ?? 'game-start');
    // ...
  }

  private persistSave(): void {
    localStorage.setItem(this.SAVE_KEY, JSON.stringify({
      stateStack: this.stateStack,
      currentState: this.state.value,
      // + any other progress fields (round, team, inventory, etc.)
    }));
  }

  private loadSave(): { stateStack: GameState[]; currentState: GameState } | null {
    const raw = localStorage.getItem(this.SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}
```

Call `persistSave()` at the end of `finishCurrentState()` so every state transition is checkpointed automatically — the player is never more than one action away from a saved point.

If you also want a **shareable/portable save** (a code the player can copy and paste on another device, rather than only relying on that browser's localStorage), base64-encode the same JSON blob for export, and `JSON.parse(atob(code))` to import it — same shape, just serialized to text instead of `localStorage`. Validate the parsed shape before trusting it (wrap in try/catch, check expected keys exist) since it's user-editable text.

## Version your storage keys

Include a version suffix in the key (`'my-game-save-v1'`) so that if the save shape changes incompatibly later, you can bump to `v2` and detect/migrate old saves instead of having `JSON.parse` succeed but hand back a shape the rest of the app doesn't expect.
