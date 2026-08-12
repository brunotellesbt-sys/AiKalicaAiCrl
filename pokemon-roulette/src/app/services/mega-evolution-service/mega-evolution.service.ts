import { HttpClient } from '@angular/common/http';

import { Inject, Injectable, DOCUMENT } from '@angular/core';
import {
  catchError,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';

import { PokemonItem } from '../../interfaces/pokemon-item';
import { formatMegaFormDisplayName, isMegaLikeFormName } from '../../data/mega-forms';
import { megaFormsBySpecies } from '../../data/mega-by-species';
import { PokemonService } from '../pokemon-service/pokemon.service';
import { TrainerService } from '../trainer-service/trainer.service';

export interface MegaForm {
  /** PokeAPI Pokémon id of the Mega form (or base id for custom-only forms). */
  pokemonId: number;
  /** Pokémon identifier (e.g. "charizard-mega-x", "raichu-mega-x"). */
  apiName: string;
  /** Display name (e.g. "Mega Charizard X"). */
  displayName: string;

  /** Optional sprite overrides (useful for custom forms not present in PokeAPI). */
  spriteUrl?: string;
  shinySpriteUrl?: string;

  /** Where this form came from. */
  source?: 'pokeapi' | 'custom';
}

interface CustomMegaFormsFile {
  version?: number;
  forms?: CustomMegaFormDefinition[];
}

interface CustomMegaFormDefinition {
  basePokemonId: number;
  apiName: string;
  displayName: string;
  pokemonId?: number;
  spriteUrl?: string;
  shinySpriteUrl?: string;
}

interface PokemonSpeciesResponse {
  varieties: Array<{
    is_default: boolean;
    pokemon: {
      name: string;
      url: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class MegaEvolutionService {
  private readonly apiBaseUrl = 'https://pokeapi.co/api/v2';

  /** Cache mega forms by species id to avoid re-fetching every battle. */
  private megaFormsBySpeciesId = new Map<number, Observable<MegaForm[]>>();
  private customMegaFormsByBaseId$?: Observable<Map<number, MegaForm[]>>;

  /** Only one Mega per battle (by design). */
  private currentMegaPokemon: PokemonItem | null = null;

  constructor(
    private http: HttpClient,
    private pokemonService: PokemonService,
    private trainerService: TrainerService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  /**
   * Fetch sprites by PokeAPI form name (e.g. "charizard-mega-x") and return the
   * same static artwork the Pokédex uses (official-artwork).
   *
   * If the request succeeds but artwork is missing/empty, we throw so callers
   * can fall back to explicit custom sprite URLs.
   */
  private getPokemonSpritesByNameWithFallback(
    pokemonName: string
  ): Observable<{ sprite: { front_default: string; front_shiny: string } }> {
    return this.pokemonService.getPokemonSpritesByName(pokemonName).pipe(
      mergeMap((res) => {
        const front_default = res?.sprite?.front_default ?? '';
        const front_shiny_raw = res?.sprite?.front_shiny ?? '';
        const front_shiny = front_shiny_raw || front_default;

        if (!front_default) {
          return throwError(() => new Error('Missing official artwork sprite'));
        }

        return of({ sprite: { front_default, front_shiny } });
      })
    );
  }

  private loadCustomMegaFormsByBaseId(): Observable<Map<number, MegaForm[]>> {
    if (this.customMegaFormsByBaseId$) return this.customMegaFormsByBaseId$;

    // Optional file. If missing/invalid, we just treat as no custom forms.
    this.customMegaFormsByBaseId$ = this.http
      .get<CustomMegaFormsFile>(new URL('data/custom-mega-forms.json', this.document.baseURI).toString())
      .pipe(
        map((file) => {
          const byBaseId = new Map<number, MegaForm[]>();
          const forms = file?.forms ?? [];

          for (const def of forms) {
            if (!def) continue;
            const baseId = Number(def.basePokemonId);
            if (!Number.isFinite(baseId) || baseId <= 0) continue;
            if (!def.apiName || !def.displayName) continue;

            const form: MegaForm = {
              // If a custom form doesn't have a dedicated id, we keep baseId so the game
              // remains stable (Mega state is still tracked via megaBackup).
              pokemonId: Number.isFinite(Number(def.pokemonId)) ? Number(def.pokemonId) : baseId,
              apiName: def.apiName,
              displayName: def.displayName,
              spriteUrl: def.spriteUrl,
              shinySpriteUrl: def.shinySpriteUrl,
              source: 'custom',
            };

            const list = byBaseId.get(baseId) ?? [];
            list.push(form);
            byBaseId.set(baseId, list);
          }

          // Stable order for UI.
          for (const [k, list] of byBaseId.entries()) {
            list.sort((a, b) => a.displayName.localeCompare(b.displayName));
            byBaseId.set(k, list);
          }

          return byBaseId;
        }),
        catchError(() => of(new Map<number, MegaForm[]>())),
        shareReplay(1)
      );

    return this.customMegaFormsByBaseId$;
  }

  /** Returns all Mega forms available for the given Pokémon. */
  /**
   * Every species that has a Mega-like form, answered without touching PokeAPI.
   *
   * getMegaFormsForPokemon() costs one API round trip per Pokémon, so asking it "can anyone
   * on this team Mega Evolve?" meant six requests before the game could decide there was
   * nothing to show. This merges the generated table with the custom-forms file — one
   * cached local fetch — so the question is answered up front and the wheel is skipped
   * outright when the answer is no.
   */
  megaCapableSpeciesIds(): Observable<Set<number>> {
    return this.loadCustomMegaFormsByBaseId().pipe(
      map((customByBaseId) => {
        const ids = new Set<number>(Object.keys(megaFormsBySpecies).map(Number));
        for (const baseId of customByBaseId.keys()) ids.add(baseId);
        return ids;
      })
    );
  }

  /**
   * True when this Pokémon has a Mega-like form, judged from local data only.
   *
   * Matched on the Pokémon's own id rather than its base species. `basePokemonId` exists so
   * species-level questions — evolution chains, cries — resolve for a regional form, but
   * Mega Evolution is a property of the form, not the species. Reading it here let Alolan
   * Raichu collapse onto Raichu and inherit a Mega that only the Kantonian form has; the
   * same went for every other regional variant of a Mega-capable species.
   *
   * A regional form that genuinely has one is still covered: its own id would be the base
   * id of that entry in the forms table.
   */
  canMegaEvolveLocally(pokemon: PokemonItem, capable: Set<number>): boolean {
    return capable.has(pokemon.pokemonId);
  }

  /** A regional or alternate form: carries a base species that is not itself. */
  private isVariantForm(pokemon: PokemonItem): boolean {
    return pokemon.basePokemonId != null && pokemon.basePokemonId !== pokemon.pokemonId;
  }

  getMegaFormsForPokemon(pokemon: PokemonItem): Observable<MegaForm[]> {
    // A variant form does not inherit the base species' Megas — see canMegaEvolveLocally.
    // Guarded here too because this fetches the species and would otherwise hand back the
    // base form's list for a regional one.
    if (this.isVariantForm(pokemon)) return of([]);

    const speciesId = pokemon.pokemonId;

    const cached = this.megaFormsBySpeciesId.get(speciesId);
    if (cached) return cached;

    const request$ = this.loadCustomMegaFormsByBaseId().pipe(
      switchMap((customByBaseId) =>
        this.http.get<PokemonSpeciesResponse>(`${this.apiBaseUrl}/pokemon-species/${speciesId}/`).pipe(
          map((response) => {
            const fromApi: MegaForm[] = (response?.varieties ?? [])
              .filter((v) => this.isMegaLikeVariety(v?.pokemon?.name ?? ''))
              .map((v) => {
                const apiName = v.pokemon.name;
                const id = this.extractIdFromUrl(v.pokemon.url);
                return {
                  pokemonId: id > 0 ? id : speciesId,
                  apiName,
                  displayName: this.formatMegaDisplayName(apiName),
                  // Prefer the same static artwork used by the in-game Pokédex.
                  // Leave spriteUrl undefined so megaEvolveForBattle pulls official artwork via PokemonService.
                  source: 'pokeapi' as const,
                } as MegaForm;
              });

            const custom: MegaForm[] = (customByBaseId.get(speciesId) ?? []).map((f) => ({
              ...f,
              // Custom forms may not exist on PokéAPI.
              // If sprites are provided in custom-mega-forms.json, use them; otherwise we'll try PokéAPI.
              spriteUrl: f.spriteUrl ?? undefined,
              shinySpriteUrl: f.shinySpriteUrl ?? undefined,
              source: f.source ?? ('custom' as const),
            }));

            // Merge + dedupe by apiName. Custom entries override others if they share apiName.
            const byName = new Map<string, MegaForm>();
            for (const f of fromApi) {
              byName.set(f.apiName, f);
            }
            for (const f of custom) {
              const fromPokeApi = byName.get(f.apiName);
              if (!fromPokeApi) {
                byName.set(f.apiName, f);
                continue;
              }

              // A custom entry without an explicit "pokemonId" falls back to the species id,
              // which is a placeholder rather than a real override. Keep PokeAPI's form id in
              // that case — it's what identifies the form's own artwork and cry.
              const pokemonId = f.pokemonId === speciesId ? fromPokeApi.pokemonId : f.pokemonId;
              byName.set(f.apiName, { ...fromPokeApi, ...f, pokemonId });
            }

            return Array.from(byName.values()).sort((a, b) =>
              a.displayName.localeCompare(b.displayName)
            );
          }),
          catchError((error) => {
            console.error('Failed to fetch Mega forms for species', speciesId, error);

            const custom: MegaForm[] = (customByBaseId.get(speciesId) ?? []).map((f) => ({
              ...f,
              spriteUrl: f.spriteUrl ?? undefined,
              shinySpriteUrl: f.shinySpriteUrl ?? undefined,
              source: f.source ?? ('custom' as const),
            }));

            const byName = new Map<string, MegaForm>();
            for (const f of custom) {
              byName.set(f.apiName, f);
            }
            return of(Array.from(byName.values()));
          })
        )
      ),
      shareReplay(1)
    );

    this.megaFormsBySpeciesId.set(speciesId, request$);
    return request$;
  }

  /** Applies Mega Evolution for the current battle. */
  megaEvolveForBattle(pokemon: PokemonItem, megaForm: MegaForm): Observable<void> {
    this.revertCurrentMegaEvolution();

    pokemon.megaBackup = {
      text: pokemon.text,
      sprite: pokemon.sprite,
      power: pokemon.power,
    };

    const megaPower: 5 | 6 = pokemon.power === 5 ? 6 : 5;

    // Prefer the exact same static artwork the Pokédex uses:
    //  - try PokéAPI "pokemon/<formName>" (official-artwork)
    //  - if the form doesn't exist on PokéAPI, fall back to an explicit custom spriteUrl (if provided)
    //  - otherwise fall back to the numeric id (best-effort)
    const sprite$ = this.getPokemonSpritesByNameWithFallback(megaForm.apiName).pipe(
      catchError(() => {
        if (megaForm.spriteUrl) {
          return of({
            sprite: {
              front_default: megaForm.spriteUrl,
              front_shiny: megaForm.shinySpriteUrl ?? megaForm.spriteUrl,
            },
          });
        }
        return this.pokemonService.getPokemonSprites(megaForm.pokemonId);
      })
    );

    return sprite$.pipe(
      map((result) => {
        pokemon.sprite = result.sprite;
        pokemon.text = megaForm.displayName;
        pokemon.power = megaPower;
        pokemon.isMegaEvolved = true;
        // Type Advantage mode scores the form on the field, not the base species.
        pokemon.megaFormId = megaForm.pokemonId;
        this.currentMegaPokemon = pokemon;

        this.trainerService.updateTeam();
      }),
      catchError((error) => {
        console.error('Failed to mega evolve', pokemon, megaForm, error);
        this.revertCurrentMegaEvolution();
        return throwError(() => error);
      })
    );
  }


  /** Reverts the currently Mega-Evolved Pokémon (if any). Call this after a battle ends. */
  revertCurrentMegaEvolution(): void {
    const pokemon = this.currentMegaPokemon;
    if (!pokemon?.megaBackup) {
      this.currentMegaPokemon = null;
      return;
    }

    pokemon.text = pokemon.megaBackup.text;
    pokemon.sprite = pokemon.megaBackup.sprite;
    pokemon.power = pokemon.megaBackup.power;
    pokemon.isMegaEvolved = false;
    delete pokemon.megaFormId;
    delete pokemon.megaBackup;

    this.currentMegaPokemon = null;

    this.trainerService.updateTeam();
  }

  /** Backwards-compatible name used by older callers. */
  revertMegaEvolution(): void {
    this.revertCurrentMegaEvolution();
  }

  /** Extracts numeric id from a PokeAPI resource URL. Returns 0 if parsing fails. */
  private extractIdFromUrl(url: string): number {
    try {
      const parts = url.split('/').filter(Boolean);
      const idStr = parts[parts.length - 1];
      const id = Number(idStr);
      return Number.isFinite(id) ? id : 0;
    } catch {
      return 0;
    }
  }


  /**
   * Builds a Pokémon Showdown "ANI" sprite URL for a given apiName.
   * Uses GIFs from /sprites/ani and /sprites/ani-shiny (these are updated more often than /home).
   * Example: "charizard-mega-x" -> "charizard-megax.gif"
   */
  private getShowdownAniSpriteUrl(apiName: string, shiny: boolean): string {
    // Normalize "-mega-x"/"-mega-y"/"-mega-z" to Showdown filenames "-megax"/"-megay"/"-megaz".
    const fileBase = apiName
      .toLowerCase()
      .replace(/-mega-(x|y|z)$/, (_m, p1) => `-mega${p1}`);

    const dir = shiny ? 'ani-shiny' : 'ani';
    return `https://play.pokemonshowdown.com/sprites/${dir}/${fileBase}.gif`;
  }

  /** See data/mega-forms.ts — shared with the Pokédex so the two never disagree. */
  private isMegaLikeVariety(varietyName: string): boolean {
    return isMegaLikeFormName(varietyName);
  }

  private formatMegaDisplayName(apiName: string): string {
    return formatMegaFormDisplayName(apiName);
  }

}
