import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { PokemonItem } from '../../interfaces/pokemon-item';
import {
  VillainGrunt,
  VillainTeam,
  hasRivalTeams,
  teamsForGeneration,
} from '../../data/villain-teams';

/**
 * Who mugged you, and what they are still holding.
 *
 * The run already had a mechanic where beating the villain team gives back the Pokémon it
 * stole, but it only tracked one stolen Pokémon at a time and had no idea which team had
 * taken it. In Hoenn that reads as a bug: Aqua robs you, later you beat Magma, and Magma
 * hands over something it never took.
 *
 * Each organisation now keeps its own haul. Beating one returns exactly what that one took
 * and nothing else, and clearing a region's boss releases everything still held there — so
 * a Pokémon is never permanently lost, but getting it back means beating the team that
 * actually has it.
 */
@Injectable({ providedIn: 'root' })
export class VillainTeamService {
  /** Stolen Pokémon, keyed by the team holding them. */
  private readonly haul = new Map<string, PokemonItem[]>();

  /** The team in the encounter currently on screen. */
  private readonly encounterSubject$ = new BehaviorSubject<VillainTeam | null>(null);
  readonly encounter$: Observable<VillainTeam | null> = this.encounterSubject$.asObservable();

  /** The grunt on screen; null at a boss encounter, where the boss is shown instead. */
  private readonly gruntSubject$ = new BehaviorSubject<VillainGrunt | null>(null);
  readonly grunt$: Observable<VillainGrunt | null> = this.gruntSubject$.asObservable();

  get currentTeam(): VillainTeam | null {
    return this.encounterSubject$.value;
  }

  get currentGrunt(): VillainGrunt | null {
    return this.gruntSubject$.value;
  }

  teamsFor(generationId: number): VillainTeam[] {
    return teamsForGeneration(generationId);
  }

  /** True where the run has to roll for which organisation turned up — Hoenn, today. */
  needsTeamRoll(generationId: number): boolean {
    return hasRivalTeams(generationId);
  }

  /**
   * Sets the team for the encounter about to happen.
   *
   * A roadside encounter also draws a grunt; a boss encounter does not, because the boss is
   * the whole point of that one and showing a grunt alongside would undercut it.
   */
  beginEncounter(team: VillainTeam, kind: 'roadside' | 'boss' = 'roadside'): void {
    this.encounterSubject$.next(team);
    this.gruntSubject$.next(kind === 'roadside' ? this.randomGrunt(team) : null);
  }

  /** Picks one of the region's teams at random — the Magma-or-Aqua roll. */
  rollTeam(generationId: number): VillainTeam | null {
    const teams = this.teamsFor(generationId);
    if (!teams.length) return null;

    return teams[Math.floor(Math.random() * teams.length)];
  }

  private randomGrunt(team: VillainTeam): VillainGrunt | null {
    if (!team.grunts.length) return null;

    return team.grunts[Math.floor(Math.random() * team.grunts.length)];
  }

  /** Files a Pokémon under the team that took it. */
  steal(teamId: string, pokemon: PokemonItem): void {
    const held = this.haul.get(teamId) ?? [];
    held.push(pokemon);
    this.haul.set(teamId, held);
  }

  /** What a given team is still holding, for a UI that wants to say so. */
  heldBy(teamId: string): PokemonItem[] {
    return [...(this.haul.get(teamId) ?? [])];
  }

  /**
   * Beating one team: hand back what that team took, and only that.
   *
   * Emptied rather than merely read, because the same organisation can rob you again later
   * in the run and the second haul has to start from nothing.
   */
  recoverFrom(teamId: string): PokemonItem[] {
    const held = this.haul.get(teamId) ?? [];
    this.haul.delete(teamId);
    return held;
  }

  /**
   * Clearing the region's boss: everything any of the region's teams still holds.
   *
   * This is what stops a Pokémon being lost for good. A Hoenn run can lose one to Aqua and
   * never draw Aqua again, so without a release at the boss it would simply be gone.
   */
  recoverForGeneration(generationId: number): PokemonItem[] {
    return this.teamsFor(generationId).flatMap((team) => this.recoverFrom(team.id));
  }

  /** Total still held across every team, for a "you are missing some" readout. */
  get totalHeld(): number {
    let held = 0;
    for (const list of this.haul.values()) held += list.length;
    return held;
  }

  /** A new run starts with nobody holding anything. */
  reset(): void {
    this.haul.clear();
    this.encounterSubject$.next(null);
    this.gruntSubject$.next(null);
  }
}
