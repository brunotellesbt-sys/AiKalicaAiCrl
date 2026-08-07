import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { PokemonType } from '../../data/type-chart';
import {
  championAceByGeneration,
  championTeamsByGeneration,
  battleTrainerAceByGeneration,
  battleTrainerTeamsByGeneration,
  eliteFourAcesByGeneration,
  eliteFourTeamsByGeneration,
  gymLeaderAcesByGeneration,
  gymLeaderTeamsByGeneration,
  extraFieldAceByGeneration,
  extraFieldTeamsByGeneration,
  femaleProtagonistAceByGeneration,
  femaleProtagonistTeamsByGeneration,
  protagonistAceByGeneration,
  protagonistTeamsByGeneration,
  rivalAceByGeneration,
  rivalTeamsByGeneration,
} from '../../data/trainer-teams';
import {
  championTypesByGeneration,
  eliteFourTypesByGeneration,
  gymLeaderTypesByGeneration,
  BATTLE_TRAINER_TYPES,
  RIVAL_TYPES,
} from '../../data/trainer-type-themes';
import { gymLeadersByGeneration } from '../../main-game/roulette-container/roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from '../../main-game/roulette-container/roulettes/elite-four-battle-roulette/elite-four-by-generation';
import { championByGeneration } from '../../main-game/roulette-container/roulettes/champion-battle-roulette/champion-by-generation';
import {
  COUNTERPART_RIVAL_GENERATIONS,
  rivalByGeneration,
} from '../../main-game/roulette-container/roulettes/rival-battle-roulette/rival-by-generation';
import {
  battleTrainerByGeneration,
  extraFieldTrainerByGeneration,
  protagonistCharacterByGeneration,
} from '../../data/generation-encounters';
import { preferredMegaFor } from '../../data/preferred-megas';

export type TournamentKind = 'regional' | 'world';
export type TournamentStage = 'draw' | 'groups' | 'knockout' | 'won' | 'eliminated';

export interface Competitor {
  /** Stable key, unique within a tournament. */
  id: string;
  /** Display name, or a translation key when the source data uses one. */
  name: string;
  spriteUrl: string;
  generationId: number;
  /** Canonical National Dex roster, in the order the trainer uses it. */
  roster: number[];
  ace: number;
  themeTypes: PokemonType[];
  isPlayer: boolean;
  /** apiName of a Mega form this trainer always uses; '' for everyone else. */
  preferredMegaForm?: string;
}

export interface TournamentMatch {
  round: number;
  index: number;
  a: Competitor | null;
  b: Competitor | null;
  winner: Competitor | null;
  /** True when the player is one of the two sides. */
  playerMatch: boolean;
}

export interface GroupStanding {
  competitor: Competitor;
  played: number;
  wins: number;
  losses: number;
  points: number;
}

export interface TournamentGroup {
  name: string;
  standings: GroupStanding[];
  /** Round-robin fixtures, in play order. */
  fixtures: Array<{ a: Competitor; b: Competitor; winner: Competitor | null }>;
}

/** Every opponent in a tournament fields a full, fully evolved squad. */
export const TOURNAMENT_TEAM_SIZE = 6;

const POINTS_FOR_WIN = 3;
const REGIONAL_FIELD = 16;
const WORLD_GROUP_SIZE = 4;
/**
 * One qualifier per group.
 *
 * The World Tournament fields every trainer in the game rather than a sample of them, so
 * the group stage is what does the narrowing — taking two from each group would push the
 * bracket past seventy entrants and turn the run into a marathon.
 */
const WORLD_QUALIFY_PER_GROUP = 1;

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private kindSubject$ = new BehaviorSubject<TournamentKind | null>(null);
  private stageSubject$ = new BehaviorSubject<TournamentStage>('draw');
  private stateVersion$ = new BehaviorSubject<number>(0);

  /** Competitors still waiting to be drawn, and the seeded order built so far. */
  private drawBag: Competitor[] = [];
  private seeded: Competitor[] = [];

  private groups: TournamentGroup[] = [];
  private rounds: TournamentMatch[][] = [];
  private player: Competitor | null = null;
  private generationId = 1;
  private potions = 0;
  /** Decides which half of each protagonist pair the player faces. */
  private playerGender: string = 'male';

  private readonly translate = inject(TranslateService);

  /**
   * What the player actually reads on screen.
   *
   * Competitor names are a mix of literals and translation keys, and two *different* keys
   * can render the same person: Koga is `gymLeaders.koga.name` in Kanto and
   * `elite4.koga.name` in Johto. Uniqueness has to be judged on the rendered string, not
   * the key, or the same trainer shows up twice in one bracket.
   */
  private displayName(competitor: Competitor): string {
    return competitor.name.includes('.')
      ? this.translate.instant(competitor.name)
      : competitor.name;
  }

  /**
   * Folds every repeat of a person into their first entry instead of throwing it away.
   *
   * Holding two jobs is canon, not a data error: Paldea's Larry runs the Medali Gym and
   * sits in the Elite Four, Galar brings Nessa, Bea and Raihan back as Elite Four members,
   * Koga leads a Kanto gym and an Elite Four seat in Johto. A tournament seats people, so
   * each of them enters once — but as their strongest self, with the Pokémon of *both*
   * roles pooled and every type they cover carried over. Nothing about them is discarded;
   * they simply cannot be drawn against themselves.
   */
  private mergeDuplicatePeople(field: Competitor[]): Competitor[] {
    const merged: Competitor[] = [];
    // Keyed by *person*, not by label, so a shared slot finds its members.
    const byPerson = new Map<string, Competitor>();

    // Someone named on their own outranks the same person inside a shared slot. Without
    // this, Galar's Elite Four slot "Marnie/Hop/Bede" was seated first and then swallowed
    // Marnie the rival and Hop the Battle Trainer, so neither reached the bracket. Seating
    // the individuals first leaves the shared slot to fold into one of them instead.
    const ordered = [
      ...field.filter((c) => this.peopleIn(this.displayName(c)).length === 1),
      ...field.filter((c) => this.peopleIn(this.displayName(c)).length > 1),
    ];

    for (const competitor of ordered) {
      const people = this.peopleIn(this.displayName(competitor));
      const existing = people.map((p) => byPerson.get(p)).find(Boolean);

      if (!existing) {
        // Copy, so folding a later role in never mutates the source data.
        const copy = {
          ...competitor,
          roster: [...competitor.roster],
          themeTypes: [...competitor.themeTypes],
        };
        for (const person of people) byPerson.set(person, copy);
        merged.push(copy);
        continue;
      }

      for (const id of competitor.roster) {
        if (!existing.roster.includes(id)) existing.roster.push(id);
      }
      for (const type of competitor.themeTypes) {
        if (!existing.themeTypes.includes(type)) existing.themeTypes.push(type);
      }
      // Claim this competitor's other members too, so a third slot naming any of them folds
      // into the same person rather than opening a new seat.
      for (const person of people) {
        if (!byPerson.has(person)) byPerson.set(person, existing);
      }
      // The first role keeps the ace: it is the signature the character is built around.
    }

    return merged;
  }

  /**
   * The individual trainers named by a slot label.
   *
   * Several slots stand for more than one person — "Sophocles/Acerola", "Marnie/Hop/Bede",
   * "Tate and Liza" — and those same people also hold jobs of their own. Comparing whole
   * labels misses that, so Galar seated both "Marnie" and "Marnie/Hop/Bede". Splitting the
   * label into people lets the merge recognise them.
   */
  private peopleIn(label: string): string[] {
    return label
      .split(/\s*(?:\/|&|\band\b)\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  readonly kind$: Observable<TournamentKind | null> = this.kindSubject$.asObservable();
  readonly stage$: Observable<TournamentStage> = this.stageSubject$.asObservable();
  /** Bumped whenever the bracket or standings change, so views can refresh. */
  readonly changes$: Observable<number> = this.stateVersion$.asObservable();

  get kind(): TournamentKind | null {
    return this.kindSubject$.value;
  }

  get stage(): TournamentStage {
    return this.stageSubject$.value;
  }

  get isActive(): boolean {
    return this.kind !== null && this.stage !== 'won' && this.stage !== 'eliminated';
  }

  get bracket(): TournamentMatch[][] {
    return this.rounds;
  }

  get groupTable(): TournamentGroup[] {
    return this.groups;
  }

  get seededOrder(): Competitor[] {
    return this.seeded;
  }

  /** How many competitors this tournament actually holds — the whole field, never a sample. */
  get fieldSize(): number {
    return this.seeded.length + this.drawBag.length;
  }

  /**
   * Spins the draw wheel still owes.
   *
   * The regional draw reveals all sixteen, one spin each, as it always has. The World
   * Tournament fields well over a hundred trainers, so it reveals the player's own group —
   * the three they actually have to beat — and seeds the rest of the world at once.
   */
  get remainingToDraw(): number {
    if (this.kind !== 'world') return this.drawBag.length;
    return Math.max(0, Math.min(WORLD_GROUP_SIZE - this.seeded.length, this.drawBag.length));
  }

  /**
   * Potions the player is handed when a phase begins.
   *
   * The tournaments deliberately do not use the run's lives: elimination is final, and the
   * only safety net is the fixed potion allowance.
   */
  potionsForCurrentPhase(): number {
    if (this.kind === 'regional') return 3;
    if (this.kind === 'world') return this.stage === 'knockout' ? 3 : 0;
    return 0;
  }

  /**
   * Plain Potions still in hand for this phase.
   *
   * Deliberately separate from the run's item bag: a tournament entrant is handed a fixed
   * allowance and cannot carry in the Super/Hyper Potions they hoarded during the run, so
   * every entrant faces the bracket on the same terms.
   */
  get potionsLeft(): number {
    return this.potions;
  }

  /** Hands out the allowance for the phase that is about to start. */
  grantPhasePotions(): void {
    this.potions = this.potionsForCurrentPhase();
    this.touch();
  }

  /** Spends one Potion for a re-spin. Returns false when the bag is empty. */
  usePotion(): boolean {
    if (this.potions <= 0) return false;
    this.potions--;
    this.touch();
    return true;
  }

  // ---------------------------------------------------------------- setup

  /**
   * Opens a tournament and fills the draw bag.
   *
   * Regional: the player plus the 15 opponents of their own region (8 gym leaders, the
   * rival, the roadside trainer, the Elite Four and the Champion) — exactly 16.
   * World: the player plus 31 drawn from every generation, protagonists included.
   */
  start(
    kind: TournamentKind,
    generationId: number,
    playerSpriteUrl: string,
    playerGender: string = 'male'
  ): void {
    this.generationId = generationId;
    this.playerGender = playerGender;
    this.kindSubject$.next(kind);
    this.stageSubject$.next('draw');

    this.groups = [];
    this.rounds = [];
    this.seeded = [];

    this.player = {
      id: 'player',
      name: 'game.main.tournament.you',
      spriteUrl: playerSpriteUrl,
      generationId,
      roster: [],
      ace: 0,
      themeTypes: [],
      isPlayer: true,
    };

    const pool = kind === 'regional' ? this.regionalField(generationId) : this.worldField();

    if (kind === 'world') {
      // Everyone competes. The old build sampled 32 out of the pool, which meant well over a
      // hundred trainers never entered their own World Tournament; the group stage is what
      // narrows the field now, so nobody is left out before a single battle is fought.
      // The player is seeded first so their group is the one the draw wheel reveals.
      this.seeded = [this.player];
      this.drawBag = this.shuffle(pool);
    } else {
      this.drawBag = this.shuffle([this.player, ...pool]);
    }

    this.touch();
  }

  /** Competitors still in the bag, in the order the draw wheel shows them. */
  get pendingDraw(): Competitor[] {
    return [...this.drawBag];
  }

  /**
   * Draws one competitor into the next seed slot — one wheel spin per call.
   *
   * `index` is the slice the wheel stopped on, so the name the player watched it land on is
   * the name that gets seeded. Omitting it takes the front of the bag, which is what the
   * final competitor does when there is nothing left to spin for.
   */
  drawNext(index?: number): Competitor | null {
    const at = index != null && index >= 0 && index < this.drawBag.length ? index : 0;
    const next = this.drawBag.splice(at, 1)[0] ?? null;
    if (next) this.seeded.push(next);

    if (this.remainingToDraw === 0) {
      // Whatever the wheel did not reveal still enters — it is seeded straight into the
      // groups behind the player's own.
      this.seeded.push(...this.drawBag);
      this.drawBag = [];

      if (this.kind === 'world') {
        this.buildGroups();
        this.stageSubject$.next('groups');
      } else {
        this.buildBracket(this.seeded);
        this.stageSubject$.next('knockout');
      }
    }

    this.touch();
    return next;
  }

  // ---------------------------------------------------------------- play

  /** The next fixture the player has to actually battle, or null when there is none. */
  currentPlayerMatch(): { a: Competitor; b: Competitor } | null {
    if (this.stage === 'groups') {
      const group = this.playerGroup();
      const fixture = group?.fixtures.find(
        (f) => !f.winner && (f.a.isPlayer || f.b.isPlayer)
      );
      return fixture ? { a: fixture.a, b: fixture.b } : null;
    }

    if (this.stage === 'knockout') {
      const match = this.currentRound()?.find((m) => m.playerMatch && !m.winner && m.a && m.b);
      return match ? { a: match.a!, b: match.b! } : null;
    }

    return null;
  }

  /** The opponent the player faces right now. */
  currentOpponent(): Competitor | null {
    const match = this.currentPlayerMatch();
    if (!match) return null;
    return match.a.isPlayer ? match.b : match.a;
  }

  /**
   * Records the player's result and moves the tournament forward, resolving every other
   * fixture of the same round so the table is always complete when it is shown.
   */
  reportPlayerResult(playerWon: boolean): void {
    if (this.stage === 'groups') {
      this.resolveGroupRound(playerWon);
      return;
    }

    if (this.stage !== 'knockout') return;

    const round = this.currentRound();
    if (!round) return;

    for (const match of round) {
      if (match.winner || !match.a || !match.b) continue;

      if (match.playerMatch) {
        const player = match.a.isPlayer ? match.a : match.b;
        const rival = match.a.isPlayer ? match.b : match.a;
        match.winner = playerWon ? player : rival;
      } else {
        match.winner = this.coinFlip(`${match.round}:${match.index}`) ? match.a : match.b;
      }
    }

    if (!playerWon) {
      this.stageSubject$.next('eliminated');
      this.touch();
      return;
    }

    // Winners move into the next round; the last one standing ends the tournament.
    const winners = round.map((m) => m.winner!).filter(Boolean);
    if (winners.length <= 1) {
      this.stageSubject$.next('won');
      this.touch();
      return;
    }

    this.rounds.push(this.pairUp(winners, this.rounds.length));
    this.advancePastByes();
    this.touch();
  }

  // ---------------------------------------------------------------- groups

  /**
   * Splits the whole field into groups of at most four, as evenly as the numbers allow.
   *
   * The count follows the field rather than the other way round, so no one is cut to make
   * a tidy number: 142 entrants become 34 groups of four and two of three.
   */
  private groupSizes(total: number): number[] {
    const count = Math.ceil(total / WORLD_GROUP_SIZE);
    const base = Math.floor(total / count);
    const remainder = total % count;

    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  }

  /** A, B, … Z, AA, AB — the field runs well past 26 groups. */
  private groupName(index: number): string {
    let name = '';
    for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
      name = String.fromCharCode(65 + (n % 26)) + name;
    }
    return name;
  }

  private buildGroups(): void {
    this.groups = [];

    let cursor = 0;
    for (const [g, size] of this.groupSizes(this.seeded.length).entries()) {
      const members = this.seeded.slice(cursor, cursor + size);
      cursor += size;
      if (members.length < 2) continue;

      const fixtures: TournamentGroup['fixtures'] = [];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          fixtures.push({ a: members[i], b: members[j], winner: null });
        }
      }

      // The player's own fixtures come first so they are never left waiting.
      fixtures.sort((x, y) => Number(y.a.isPlayer || y.b.isPlayer) - Number(x.a.isPlayer || x.b.isPlayer));

      this.groups.push({
        name: this.groupName(g),
        standings: members.map((competitor) => ({
          competitor,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        })),
        fixtures,
      });
    }
  }

  private playerGroup(): TournamentGroup | undefined {
    return this.groups.find((g) => g.standings.some((s) => s.competitor.isPlayer));
  }

  private resolveGroupRound(playerWon: boolean): void {
    const group = this.playerGroup();
    const fixture = group?.fixtures.find((f) => !f.winner && (f.a.isPlayer || f.b.isPlayer));
    if (!group || !fixture) return;

    const player = fixture.a.isPlayer ? fixture.a : fixture.b;
    const rival = fixture.a.isPlayer ? fixture.b : fixture.a;
    this.applyResult(group, playerWon ? player : rival, playerWon ? rival : player);
    fixture.winner = playerWon ? player : rival;

    // Once the player has no fixtures left, settle the rest of the tournament's group phase.
    const playerDone = !group.fixtures.some((f) => !f.winner && (f.a.isPlayer || f.b.isPlayer));
    if (!playerDone) {
      this.touch();
      return;
    }

    for (const grp of this.groups) {
      for (const [i, f] of grp.fixtures.entries()) {
        if (f.winner) continue;
        const winner = this.coinFlip(`${grp.name}:${i}`) ? f.a : f.b;
        f.winner = winner;
        this.applyResult(grp, winner, winner === f.a ? f.b : f.a);
      }
    }

    const qualifiers = this.groups.flatMap((grp) =>
      [...grp.standings]
        .sort((a, b) => b.points - a.points || b.wins - a.wins)
        .slice(0, WORLD_QUALIFY_PER_GROUP)
        .map((s) => s.competitor)
    );

    if (!qualifiers.some((c) => c.isPlayer)) {
      this.stageSubject$.next('eliminated');
      this.touch();
      return;
    }

    this.buildBracket(qualifiers);
    this.stageSubject$.next('knockout');
    this.touch();
  }

  private applyResult(group: TournamentGroup, winner: Competitor, loser: Competitor): void {
    for (const standing of group.standings) {
      if (standing.competitor === winner) {
        standing.played++;
        standing.wins++;
        standing.points += POINTS_FOR_WIN;
      } else if (standing.competitor === loser) {
        standing.played++;
        standing.losses++;
      }
    }
  }

  // ---------------------------------------------------------------- bracket

  private buildBracket(entrants: Competitor[]): void {
    this.rounds = [this.pairUp(entrants, 0)];
    this.advancePastByes();
  }

  /**
   * Walks the bracket forward while the player is on a bye.
   *
   * A bye is not a battle, so there is nothing to hand the player. Everyone else's fixtures
   * for that round are settled and the next one is drawn, until the player has a real
   * opponent again (or the bracket has run out and they have won).
   */
  private advancePastByes(): void {
    // Bounded: a bracket cannot outlive its own rounds.
    for (let guard = 0; guard < 16; guard++) {
      const round = this.currentRound();
      if (!round) return;

      const hasBattle = round.some((m) => m.playerMatch && !m.winner && m.a && m.b);
      if (hasBattle) return;

      const stillIn = round.some((m) => m.a?.isPlayer || m.b?.isPlayer);
      if (!stillIn) return;

      for (const match of round) {
        if (match.winner || !match.a || !match.b) continue;
        match.winner = this.coinFlip(`${match.round}:${match.index}`) ? match.a : match.b;
      }

      const winners = round.map((m) => m.winner!).filter(Boolean);
      if (winners.length <= 1) {
        this.stageSubject$.next('won');
        return;
      }

      this.rounds.push(this.pairUp(winners, this.rounds.length));
    }
  }

  /**
   * Lays out one round, handing byes out when the entrant count is not a power of two.
   *
   * A group stage that seats everybody rarely produces a tidy 16 or 32, so the first round
   * gives byes to the top seeds and pairs the rest; that leaves a power-of-two field from
   * the second round on. A bye is a walkover, not a battle — the player never sees a
   * "match" against nobody.
   */
  private pairUp(entrants: Competitor[], round: number): TournamentMatch[] {
    const matches: TournamentMatch[] = [];

    const play = (a: Competitor | null, b: Competitor | null) =>
      matches.push({
        round,
        index: matches.length,
        a,
        b,
        winner: a && !b ? a : null,
        playerMatch: Boolean(a?.isPlayer || b?.isPlayer),
      });

    // Round *down* to a power of two and play only the surplus entrants off against each
    // other. Padding upwards instead turned Kanto's 17 competitors into a "Round of 32"
    // that was fifteen walkovers around a single real fight; this plays one preliminary
    // match and then runs a clean Round of 16.
    let bracketSize = 1;
    while (bracketSize * 2 <= entrants.length) bracketSize *= 2;
    const playIns = entrants.length - bracketSize;

    if (playIns === 0) {
      // Already a power of two: everybody has an opponent.
      for (let i = 0; i < entrants.length; i += 2) play(entrants[i] ?? null, entrants[i + 1] ?? null);
      return matches;
    }

    // The surplus meet each other…
    const contested = playIns * 2;
    for (let i = 0; i < contested; i += 2) play(entrants[i], entrants[i + 1]);

    // …and everyone else walks into the next round.
    for (let i = contested; i < entrants.length; i++) {
      matches.push({
        round,
        index: matches.length,
        a: entrants[i],
        b: null,
        winner: entrants[i],
        playerMatch: false, // a bye is not a battle
      });
    }

    return matches;
  }

  private currentRound(): TournamentMatch[] | undefined {
    return this.rounds[this.rounds.length - 1];
  }

  // ---------------------------------------------------------------- field

  /**
   * The protagonist of the region the player is *not* playing as.
   *
   * Returns null for the player's own region-and-gender, so the field never seats a second
   * copy of the person the player already is.
   */
  private counterpartCompetitor(gen: number): Competitor | null {
    const pair = protagonistCharacterByGeneration[gen];
    if (!pair) return null;

    const wanted: 'male' | 'female' = this.playerGender === 'female' ? 'male' : 'female';
    const character = pair[wanted];
    if (!character) return null;

    const isFemale = wanted === 'female';

    return {
      id: `counterpart-${gen}-${wanted}`,
      name: character.name,
      spriteUrl: character.spriteUrl,
      generationId: gen,
      roster: (isFemale ? femaleProtagonistTeamsByGeneration : protagonistTeamsByGeneration)[gen] ?? [],
      ace: (isFemale ? femaleProtagonistAceByGeneration : protagonistAceByGeneration)[gen] ?? 0,
      themeTypes: [],
      isPlayer: false,
    };
  }

  private regionalField(gen: number): Competitor[] {
    const field: Competitor[] = [];

    (gymLeadersByGeneration[gen] ?? []).forEach((leader, i) => {
      field.push({
        id: `gym-${gen}-${i}`,
        name: leader.name,
        spriteUrl: Array.isArray(leader.sprite) ? leader.sprite[0] : leader.sprite,
        generationId: gen,
        roster: (gymLeaderTeamsByGeneration[gen] ?? [])[i] ?? [],
        ace: (gymLeaderAcesByGeneration[gen] ?? [])[i] ?? 0,
        themeTypes: (gymLeaderTypesByGeneration[gen] ?? [])[i] ?? [],
        isPlayer: false,
      });
    });

    (eliteFourByGeneration[gen] ?? []).forEach((member, i) => {
      field.push({
        id: `e4-${gen}-${i}`,
        name: member.name,
        spriteUrl: Array.isArray(member.sprite) ? member.sprite[0] : member.sprite,
        generationId: gen,
        roster: (eliteFourTeamsByGeneration[gen] ?? [])[i] ?? [],
        ace: (eliteFourAcesByGeneration[gen] ?? [])[i] ?? 0,
        themeTypes: (eliteFourTypesByGeneration[gen] ?? [])[i] ?? [],
        isPlayer: false,
      });
    });

    const champion = (championByGeneration as any)[gen]?.[0];
    if (champion) {
      field.push({
        id: `champion-${gen}`,
        name: champion.name,
        spriteUrl: Array.isArray(champion.sprite) ? champion.sprite[0] : champion.sprite,
        generationId: gen,
        roster: championTeamsByGeneration[gen] ?? [],
        ace: championAceByGeneration[gen] ?? 0,
        themeTypes: championTypesByGeneration[gen] ?? [],
        isPlayer: false,
      });
    }

    // The counterpart: the protagonist of the gender the player did not choose. In Hoenn and
    // Kalos that person *is* the rival, which is exactly how those games work; everywhere
    // else they are one more trainer on the region's wheel.
    const counterpart = this.counterpartCompetitor(gen);

    if (COUNTERPART_RIVAL_GENERATIONS.includes(gen) && counterpart) {
      field.push({ ...counterpart, id: `rival-${gen}`, themeTypes: RIVAL_TYPES });
    } else {
      const rival = (rivalByGeneration as any)[gen]?.[0];
      if (rival) {
        field.push({
          id: `rival-${gen}`,
          name: rival.name,
          spriteUrl: Array.isArray(rival.sprite) ? rival.sprite[0] : rival.sprite,
          generationId: gen,
          roster: rivalTeamsByGeneration[gen] ?? [],
          ace: rivalAceByGeneration[gen] ?? 0,
          themeTypes: RIVAL_TYPES,
          isPlayer: false,
        });
      }
      if (counterpart) field.push(counterpart);
    }

    // Every trainer on the region's Battle Trainer wheel competes, not just the first.
    (battleTrainerByGeneration[gen] ?? []).forEach((trainer, i) => {
      field.push({
        id: `trainer-${gen}-${i}`,
        name: trainer.name,
        spriteUrl: trainer.spriteUrl,
        generationId: gen,
        roster: (battleTrainerTeamsByGeneration[gen] ?? [])[i] ?? [],
        ace: (battleTrainerAceByGeneration[gen] ?? [])[i] ?? 0,
        themeTypes: BATTLE_TRAINER_TYPES,
        isPlayer: false,
        preferredMegaForm: preferredMegaFor(trainer.name),
      });
    });

    // A trainer can hold two roles in the same region — Paldea's Larry runs the Medali Gym
    // and sits in the Elite Four — and the roster scrape merges both parties onto one page,
    // so the two entries would be the same person with the same team. Drop the repeat and
    // top the field back up from the reserve, otherwise the bracket is a competitor short.
    const unique = this.mergeDuplicatePeople(field);
    const claimed = new Set(unique.map((c) => this.displayName(c)));

    (extraFieldTrainerByGeneration[gen] ?? []).forEach((extra, i) => {
      if (unique.length >= REGIONAL_FIELD - 1) return; // -1: the player takes the last slot
      if (claimed.has(extra.name)) return;
      claimed.add(extra.name);
      unique.push({
        id: `extra-${gen}-${i}`,
        name: extra.name,
        spriteUrl: extra.spriteUrl,
        generationId: gen,
        roster: (extraFieldTeamsByGeneration[gen] ?? [])[i] ?? [],
        ace: (extraFieldAceByGeneration[gen] ?? [])[i] ?? 0,
        themeTypes: [],
        isPlayer: false,
      });
    });

    return unique;
  }

  /** Every scripted trainer of every region, both protagonists of each included. */
  private worldField(): Competitor[] {
    const field: Competitor[] = [];

    for (let gen = 1; gen <= 9; gen++) {
      // Brings that region's gym leaders, Elite Four, Champion, rival, Battle Trainers and
      // the counterpart protagonist.
      field.push(...this.regionalField(gen));

      // …and the *other* protagonist, so both halves of every region's pair compete. The one
      // exception is the player's own region and gender: that person is the player.
      const pair = protagonistCharacterByGeneration[gen];
      const own: 'male' | 'female' = this.playerGender === 'female' ? 'female' : 'male';
      if (!pair || gen === this.generationId) continue;

      const character = pair[own];
      const isFemale = own === 'female';
      field.push({
        id: `protagonist-${gen}-${own}`,
        name: character.name,
        spriteUrl: character.spriteUrl,
        generationId: gen,
        roster: (isFemale ? femaleProtagonistTeamsByGeneration : protagonistTeamsByGeneration)[gen] ?? [],
        ace: (isFemale ? femaleProtagonistAceByGeneration : protagonistAceByGeneration)[gen] ?? 0,
        themeTypes: [],
        isPlayer: false,
      });
    }

    // Several trainers hold a role in two different regions — Koga leads a Kanto gym and
    // sits in Johto's Elite Four, Lance does the reverse — and the roster scrape merges
    // both parties onto one page, so the two entries are the same person with the same
    // team. Keep the first and drop the repeat: the pool is far larger than a 32-trainer
    // field, so nothing is lost and no bracket ever shows the same name twice.
    // Merge first, shuffle after: folding in a fixed order means the gym role always keeps
    // the sprite and the ace, instead of that depending on how the shuffle fell.
    return this.shuffle(this.mergeDuplicatePeople(field));
  }

  // ---------------------------------------------------------------- misc

  reset(): void {
    this.kindSubject$.next(null);
    this.stageSubject$.next('draw');
    this.drawBag = [];
    this.seeded = [];
    this.groups = [];
    this.rounds = [];
    this.player = null;
    this.potions = 0;
    this.touch();
  }

  private touch(): void {
    this.stateVersion$.next(this.stateVersion$.value + 1);
  }

  /** Deterministic per key, so a table never changes when a view re-renders. */
  private coinFlip(key: string): boolean {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 2) === 0;
  }

  private shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
