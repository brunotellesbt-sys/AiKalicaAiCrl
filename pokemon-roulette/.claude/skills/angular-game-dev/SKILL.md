---
name: angular-game-dev
description: Patterns and best practices for building browser games in Angular (standalone components, Angular 17+/19+ style) — state machines, canvas-based game loops, RNG/weighted selection, animation timing, persisted settings/save data, broken-image/sprite fallback handling, and component composition for game UI. Use this skill whenever the user is building a game, mini-game, roulette/wheel, quiz, or any interactive playable experience in Angular, or asks how to structure game state, animate a canvas, add sound effects, save/persist game progress or settings, handle sprites/images that might fail to load, or organize game components/services — even if they don't use the word "game" explicitly (e.g. "spinning wheel", "randomizer", "battle screen", "turn-based flow", "save my progress").
---

# Angular Game Development

Practical patterns for building games in Angular, based on real working game code (a Pokémon-themed roulette/adventure game using Angular 19 standalone components + RxJS).

## Core principles

1. **Game state lives in a service, never in a component.** Components render; a dedicated `*-state.service.ts` (or similar) owns the source of truth via `BehaviorSubject`s exposed as `Observable`s. This keeps state deterministic and testable, and lets any component subscribe without prop-drilling.
2. **Canvas + `requestAnimationFrame` for anything that animates continuously** (wheels, sprites, particle effects). Never use `setInterval` for animation — it drifts and doesn't sync to the display refresh.
3. **Standalone components, one concern per component.** Each game screen/mechanic (e.g. a "roulette", a "battle", a "dialog box") is its own standalone component with its own `.ts`/`.html`/`.css`, composed together by a container component. Don't build one giant God component.
4. **Always clean up subscriptions and event listeners.** Every `subscribe()` in `ngOnInit` gets an `unsubscribe()` in `ngOnDestroy`. Every `window.addEventListener` gets a matching `removeEventListener`. Games tend to mount/unmount screens frequently, so leaks compound fast.
5. **Weighted randomness, not naive `Math.random() * array.length`.** When outcomes should have different probabilities (rare drops, boss odds, prize wheels), use cumulative-weight selection (see `references/rng-and-weighting.md`).
6. **Anything that should survive a reload (settings, save progress) is a `BehaviorSubject` seeded from `localStorage` on construction and written back on every change** — never read/write `localStorage` ad hoc from components (see `references/persisted-state-and-saves.md`).
7. **Any `<img>` whose `src` comes from external/computed data (a sprite API, a CDN, user content) needs an error-fallback directive**, not a bare `<img>` tag — production will hit 404s that dev testing won't (see `references/asset-fallback-loading.md`).

## Recommended file structure

```
src/app/
  services/
    game-state-service/
      game-state.ts              # type union of all state names
      game-state.service.ts      # BehaviorSubject-based state stack/machine
    <domain>-service/            # one folder per game system (audio, items, trainer, etc.)
  interfaces/                    # plain .ts files with shared types (WheelItem, PokemonItem, ...)
  main-game/
    <feature>-container/         # orchestrates a phase of the game
      <feature>/
        <feature>.component.ts   # one component per screen/mechanic
```

Read `references/state-machine.md` before building any turn-based/phase-based game flow.
Read `references/canvas-game-loop.md` before building anything that animates on a `<canvas>`.
Read `references/component-composition.md` before wiring several game screens together.
Read `references/rng-and-weighting.md` when the game involves random outcomes, drop rates, or prize odds.
Read `references/persisted-state-and-saves.md` before adding settings, mute toggles, or save/resume progress.
Read `references/asset-fallback-loading.md` before wiring up sprites/images that load from external or computed URLs.

## Quick checklist before shipping a game feature

- [ ] Is state owned by a service (not component fields that other components can't see)?
- [ ] Does anything animate? → uses `requestAnimationFrame`, not `setInterval`.
- [ ] Are subscriptions/listeners cleaned up in `ngOnDestroy`?
- [ ] Is randomness weighted correctly if outcomes aren't meant to be equal-probability?
- [ ] Does the UI stay responsive on mobile (canvas sizing recalculated on resize, not fixed pixel values)?
- [ ] Is user-facing text going through the app's i18n/translation pipe rather than hardcoded, if the project uses one?
- [ ] Does anything need to survive a reload (settings, mute state, progress)? → persisted-`BehaviorSubject` service, not ad hoc `localStorage` calls in components.
- [ ] Do any `<img>` sources come from external/computed URLs (sprite APIs, IDs, user data)? → needs an error-fallback directive, or a broken image will show in production.
