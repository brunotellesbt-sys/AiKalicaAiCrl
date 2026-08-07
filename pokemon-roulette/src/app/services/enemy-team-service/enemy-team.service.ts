import { Injectable } from '@angular/core';

import { PokemonItem } from '../../interfaces/pokemon-item';
import { pokemonByGeneration } from '../../main-game/roulette-container/roulettes/pokemon-from-generation-roulette/pokemon-by-generation';
import { nationalDexPokemon } from '../pokemon-service/national-dex-pokemon';
import { typesForPokemonId } from '../../data/pokemon-types';
import { finalFormsFor } from '../../data/evolution-finals';
import { cappedToStage } from '../../data/evolution-stages';
import { canMegaEvolve, megaFormsFor } from '../../data/mega-by-species';
import { formatMegaFormDisplayName } from '../../data/mega-forms';
import { matchupMultiplier, PokemonType } from '../../data/type-chart';

export interface EnemyPokemon {
  pokemonId: number;
  /** Translation key, e.g. "pokemon.onix". */
  text: string;
  types: PokemonType[];
  spriteUrl: string;
  /**
   * Same 1-6 scale the player's Pokémon use, read from the National Dex entry.
   *
   * Mega forms follow the player's rule (5, or 6 when the base species was already 5), so
   * an opposing Mega is genuinely more dangerous and not just differently typed.
   */
  power: number;
  /** Set on the one slot the opponent Mega Evolves. */
  isMega?: boolean;
  /** Display name of the active Mega form, e.g. "Mega Gengar". */
  megaName?: string;
}

/** Everything about an opponent's squad that is not its roster, size or region. */
export interface EnemySquadOptions {
  /** Push every member to a final evolution (from the 4th gym on). */
  fullyEvolved?: boolean;
  /** Their signature Pokémon — the one that Mega Evolves when it can. */
  aceId?: number;
  /** apiName of a Mega form this opponent always uses, e.g. 'raichu-mega-y'. */
  preferredMegaForm?: string;
  /** Deepest evolution stage allowed, for opponents faced before the 4th gym. */
  maxStage?: number;
  /** False before the 5th gym, where Megas would be too big an escalation. */
  allowMega?: boolean;
}

export interface TypeAdvantage {
  /** How many of the opponent's Pokémon at least one of yours hits super effectively. */
  covered: number;
  /** How many of YOUR Pokémon the opponent hits super effectively. */
  vulnerable: number;
  /** Final score before rounding and clamping. */
  raw: number;
  /** Extra "Yes" slices (positive) or "No" slices (negative) for the victory wheel. */
  slices: number;
  /** How many Pokémon they field beyond yours; 0 when you match or outnumber them. */
  outnumberedBy: number;
}

/** Never let typing alone decide a battle — it tilts the wheel, it doesn't win it. */
const MAX_ADVANTAGE_SLICES = 3;

/** Steps of average effectiveness per wheel slice. Higher = typing matters more. */
const ADVANTAGE_SCALE = 2;

/** Cost per Pokémon the opponent fields beyond the player's team size. */
const OUTNUMBERED_PENALTY = 0.35;

@Injectable({ providedIn: 'root' })
export class EnemyTeamService {
  private dexCache = new Map<number, PokemonItem[]>();
  private regionalIdCache = new Map<number, Set<number>>();
  private nameById = new Map<number, string>();
  private powerById = new Map<number, number>();

  /**
   * Builds an opponent's squad.
   *
   * The roster is the one they actually use in the games (see data/trainer-teams.ts),
   * taken in order: their original team first, then rematch / remake / BW2 Pokémon World
   * Tournament Pokémon when more slots are needed.
   *
   * A handful of trainers never field six — the Kalos leaders in particular have tiny
   * teams and no PWT appearance to draw from. Those get topped up with Pokémon of their
   * specialty from the region, so the gym still reads as its type.
   */
  buildTeam(
    canonicalIds: number[],
    generationId: number,
    themeTypes: PokemonType[],
    size: number,
    seedKey: string,
    options: EnemySquadOptions = {}
  ): EnemyPokemon[] {
    if (size <= 0) return [];

    const {
      fullyEvolved = false,
      aceId = 0,
      preferredMegaForm = '',
      maxStage = Infinity,
      allowMega = true,
    } = options;

    const regional = this.regionalIds(generationId);

    // Two opposite adjustments, never both: late opponents are pushed up to their final
    // form, early ones are pulled back down so the first badge is not defended by a
    // third-stage Pokémon its trainer only owns in a rematch party.
    const evolve = (id: number, salt: string) => {
      if (fullyEvolved) return this.finalFormOf(id, salt, regional);
      return Number.isFinite(maxStage) ? cappedToStage(id, maxStage) : id;
    };

    const team: number[] = [];
    const used = new Set<number>();

    /** Adds a species, evolved when required, skipping anything already on the squad. */
    const add = (id: number, salt: string): boolean => {
      if (team.length >= size) return false;
      const resolved = evolve(id, salt);
      if (!resolved || used.has(resolved)) return false;
      used.add(resolved);
      team.push(resolved);
      return true;
    };

    // Evolving collapses lines onto a shared final form (Weepinbell and Victreebel both
    // become Victreebel), so walk the whole roster rather than just its first `size`
    // entries — otherwise the squad ends up with duplicates and empty slots.
    (canonicalIds ?? []).forEach((id, i) => add(id, `${seedKey}:${i}`));

    if (team.length < size) {
      const dex = this.regionalDex(generationId);

      const themed = themeTypes.length
        ? dex.filter((p) => this.typesOf(p.pokemonId).some((t) => themeTypes.includes(t)))
        : dex;

      // Ask for extra candidates: some collapse onto forms already on the squad.
      const pool = this.pickDistinct(themed, (size - team.length) * 4, `${seedKey}:fill`);
      pool.forEach((p, i) => add(p.pokemonId, `${seedKey}:fill:${i}`));

      // Still short (a rare type in an early region): widen to the whole region.
      if (team.length < size) {
        const rest = this.pickDistinct(dex, (size - team.length) * 4, `${seedKey}:rest`);
        rest.forEach((p, i) => add(p.pokemonId, `${seedKey}:rest:${i}`));
      }
    }

    const squad = team.map((id) => this.enemyFromId(id));
    if (!allowMega) return squad;

    return this.applyOpponentMega(squad, aceId, seedKey, preferredMegaForm);
  }

  /**
   * Mega Evolves one member of the opponent's squad, whenever any of them can.
   *
   * Preference goes to their signature Pokémon (the ace of their original party), which is
   * the one these trainers actually Mega Evolve in game. If the ace has no Mega form, the
   * first team member that does takes it instead — so a squad with a Mega on it always
   * fields one, and the player has to read the Mega's typing, not the base species'.
   *
   * `preferredMegaForm` overrides both choices: some trainers are defined by one specific
   * variant, and two trainers sharing a species should not share a Mega.
   */
  private applyOpponentMega(
    team: EnemyPokemon[],
    aceId: number,
    seedKey: string,
    preferredMegaForm = ''
  ): EnemyPokemon[] {
    if (!team.length) return team;

    const candidates = team.filter((m) => canMegaEvolve(m.pokemonId));
    if (!candidates.length) return team;

    // A named form pins both the Pokémon and the variant: Ash's Pikachu line always becomes
    // Mega Raichu Y and Yellow's always becomes Mega Raichu X, so the two are never the same
    // opponent twice over.
    const preferred = preferredMegaForm
      ? candidates.find((m) => megaFormsFor(m.pokemonId).some((f) => f.apiName === preferredMegaForm))
      : undefined;

    const chosen = preferred ?? candidates.find((m) => m.pokemonId === aceId) ?? candidates[0];

    // Charizard and Mewtwo have two Megas; keep the pick stable for a given opponent.
    const forms = megaFormsFor(chosen.pokemonId);
    const form =
      (preferred && forms.find((f) => f.apiName === preferredMegaForm)) ??
      forms[this.hash(`${seedKey}:mega`) % forms.length];
    if (!form) return team;

    const megaTypes = typesForPokemonId(form.id);

    return team.map((m) =>
      m === chosen
        ? {
            ...m,
            isMega: true,
            megaName: formatMegaFormDisplayName(form.apiName),
            types: megaTypes.length ? megaTypes : m.types,
            // Same rule the player's Mega uses (MegaEvolutionService): 5, or 6 when the
            // base species was already 5.
            power: m.power === 5 ? 6 : 5,
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${form.id}.png`,
          }
        : m
    );
  }

  /**
   * Scores the player's team against an opponent's.
   *
   * Every one of your Pokémon is matched against every one of theirs, and the result is an
   * *average* over those pairings rather than a count. That matters: two Pokémon facing six
   * used to score the same as six facing six, so a tiny team with one good matchup read as
   * a landslide. Averaging makes an unanswered opponent dilute the score instead.
   *
   * Each pairing uses the real damage multiplier, not a yes/no, so a dual type that is both
   * strong and fragile nets out on its own — a 4x hit counts double a 2x one, and taking 4x
   * back cancels it.
   *
   * Power scales how much a pairing counts: a super effective matchup on a power-1 rookie
   * is worth far less than the same matchup on a fully evolved ace.
   *
   * Finally, being outnumbered is a penalty in itself. Type coverage does not make up for
   * facing six Pokémon with two.
   */
  scoreAdvantage(playerTeam: PokemonItem[], enemyTeam: EnemyPokemon[]): TypeAdvantage {
    const empty: TypeAdvantage = { covered: 0, vulnerable: 0, raw: 0, slices: 0, outnumberedBy: 0 };
    if (!playerTeam?.length || !enemyTeam?.length) return empty;

    const mine = playerTeam.map((p) => ({
      types: this.playerTypes(p),
      // Power 3 is the baseline "fully evolved-ish" Pokémon; 1 counts a third, 6 counts double.
      weight: Math.max(1, p?.power ?? 1) / 3,
    }));
    const theirs = enemyTeam.map((e) => ({
      types: e.types,
      weight: Math.max(1, e?.power ?? 3) / 3,
    }));

    let weighted = 0;

    for (const p of mine) {
      for (const enemy of theirs) {
        const off = this.effectivenessScore(matchupMultiplier(p.types, enemy.types));
        const def = this.effectivenessScore(matchupMultiplier(enemy.types, p.types));
        // Each side's power scales its own half: your ace converts its coverage, and a
        // strong opponent (or their Mega) punishes your weaknesses harder than a rookie.
        weighted += p.weight * off - enemy.weight * def;
      }
    }

    // Averaged per pairing, NOT per unit of power — dividing by the summed weight would
    // cancel power right back out, leaving a power-1 rookie scoring like a power-5 ace.
    const typeScore = weighted / (mine.length * theirs.length);

    // Each Pokémon they field beyond yours is worth half a step against you.
    const outnumbered = (theirs.length - mine.length) * OUTNUMBERED_PENALTY;

    const raw = typeScore - outnumbered;
    const slices = Math.max(
      -MAX_ADVANTAGE_SLICES,
      Math.min(MAX_ADVANTAGE_SLICES, Math.round(raw * ADVANTAGE_SCALE))
    );

    // Kept for the readout — they explain the number without being the number.
    const covered = theirs.filter((enemy) =>
      mine.some((p) => matchupMultiplier(p.types, enemy.types) > 1)
    ).length;
    const vulnerable = mine.filter((p) =>
      theirs.some((enemy) => matchupMultiplier(enemy.types, p.types) > 1)
    ).length;

    return { covered, vulnerable, raw, slices, outnumberedBy: Math.max(0, theirs.length - mine.length) };
  }

  /**
   * Damage multiplier as a signed step, so the scale is symmetric and additive:
   * 4x = +2, 2x = +1, 1x = 0, 0.5x = -1, 0.25x = -2, immune = -3.
   */
  private effectivenessScore(multiplier: number): number {
    if (multiplier <= 0) return -3;
    return Math.log2(multiplier);
  }

  /**
   * Types of a team Pokémon.
   *
   * Mega forms change typing (Mega Charizard X becomes Fire/Dragon), so a Pokémon that is
   * currently Mega Evolved is scored on its Mega typing — that is what makes Mega
   * Evolution a tactical choice in this mode rather than a flat power bump.
   */
  playerTypes(pokemon: PokemonItem): PokemonType[] {
    if (pokemon?.isMegaEvolved && pokemon.megaFormId) {
      const megaTypes = typesForPokemonId(pokemon.megaFormId);
      if (megaTypes.length) return megaTypes;
    }
    return typesForPokemonId(pokemon?.basePokemonId ?? pokemon?.pokemonId ?? 0);
  }

  /**
   * Final evolution of a species. Branching lines (Eevee, Tyrogue…) resolve to one
   * terminal form, chosen from the seed so a given opponent always brings the same squad.
   *
   * Branches are restricted to the region being played. Without that, Sneasel resolves to
   * either Weavile or Sneasler — and Sneasler is a Hisuian line from Gen 8, so Candice
   * ended up fielding a Pokémon that did not exist in Sinnoh.
   */
  private finalFormOf(pokemonId: number, salt: string, regionalIds: Set<number>): number {
    const finals = finalFormsFor(pokemonId);
    if (finals.length <= 1) return finals[0] ?? pokemonId;

    const inRegion = finals.filter((id) => regionalIds.has(id));
    const pool = inRegion.length ? inRegion : finals;

    return pool[this.hash(salt) % pool.length];
  }

  /** Dex ids available in the region being played, for branch filtering. */
  private regionalIds(generationId: number): Set<number> {
    const cached = this.regionalIdCache.get(generationId);
    if (cached) return cached;

    const ids = new Set(this.regionalDex(generationId).map((p) => p.pokemonId));
    this.regionalIdCache.set(generationId, ids);
    return ids;
  }

  /**
   * Every Pokémon available up to the chosen generation.
   *
   * pokemonByGeneration only holds the species *introduced* in each generation, which is
   * far too thin to theme a squad from: Johto alone adds barely a handful of Ghost, Steel
   * or Dragon types, so a Morty built from Johto-only species ends up with no Ghosts at
   * all. Regions in the real games are cumulative, so the pool is too.
   */
  private regionalDex(generationId: number): PokemonItem[] {
    const cached = this.dexCache.get(generationId);
    if (cached) return cached;

    const dex: PokemonItem[] = [];
    for (let gen = 1; gen <= generationId; gen++) {
      dex.push(...(pokemonByGeneration[gen] ?? []));
    }

    const resolved = dex.length ? dex : (pokemonByGeneration[1] ?? []);
    this.dexCache.set(generationId, resolved);
    return resolved;
  }

  private typesOf(pokemonId: number): PokemonType[] {
    return typesForPokemonId(pokemonId);
  }

  /** Resolves a canonical roster entry (a National Dex id) into a displayable opponent. */
  private enemyFromId(pokemonId: number): EnemyPokemon {
    this.indexDex();

    return {
      pokemonId,
      text: this.nameById.get(pokemonId) ?? `pokemon.${pokemonId}`,
      types: this.typesOf(pokemonId),
      power: this.powerById.get(pokemonId) ?? 3,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
    };
  }

  private toEnemy(p: PokemonItem): EnemyPokemon {
    return {
      pokemonId: p.pokemonId,
      text: p.text,
      types: this.typesOf(p.pokemonId),
      power: p.power ?? 3,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemonId}.png`,
    };
  }

  private indexDex(): void {
    if (this.nameById.size) return;
    for (const p of nationalDexPokemon) {
      this.nameById.set(p.pokemonId, p.text);
      this.powerById.set(p.pokemonId, p.power);
    }
  }

  /**
   * Deterministic pick, so re-rendering the leader modal doesn't reshuffle the team the
   * player is looking at. The same opponent in the same run always fields the same squad.
   */
  private pickDistinct(pool: PokemonItem[], size: number, seedKey: string): PokemonItem[] {
    const wanted = Math.min(size, pool.length);
    const picked: PokemonItem[] = [];
    const used = new Set<number>();

    let seed = this.hash(seedKey);
    let guard = 0;

    while (picked.length < wanted && guard < pool.length * 20) {
      guard++;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const candidate = pool[seed % pool.length];
      if (!candidate || used.has(candidate.pokemonId)) continue;
      used.add(candidate.pokemonId);
      picked.push(candidate);
    }

    return picked;
  }

  private hash(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}
