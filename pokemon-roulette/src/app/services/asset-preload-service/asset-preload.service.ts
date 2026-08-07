import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { trainerSpriteData } from '../trainer-service/trainer-sprite-data';
import {
  battleTrainerByGeneration,
  roadblockByGeneration,
  villainTeamByGeneration,
} from '../../data/generation-encounters';
import { mainLegendaryIdsByGeneration } from '../../data/main-legendaries-by-generation';

import { gymLeadersByGeneration } from '../../main-game/roulette-container/roulettes/gym-battle-roulette/gym-leaders-by-generation';
import { eliteFourByGeneration } from '../../main-game/roulette-container/roulettes/elite-four-battle-roulette/elite-four-by-generation';
import { championByGeneration } from '../../main-game/roulette-container/roulettes/champion-battle-roulette/champion-by-generation';
import { rivalByGeneration } from '../../main-game/roulette-container/roulettes/rival-battle-roulette/rival-by-generation';

import { PokemonService } from '../pokemon-service/pokemon.service';
import { CryService } from '../cry-service/cry.service';
import { OFFICIAL_MEGA_API_NAMES } from '../../data/official-mega-api-names';

/**
 * AssetPreloadService
 *
 * "Baixar automaticamente":
 * - After the player chooses a generation, prefetch (and SW-cache) the key assets
 *   that are guaranteed to appear for that generation.
 * - This reduces missing images/audio on slow mobile networks.
 */
@Injectable({ providedIn: 'root' })
export class AssetPreloadService {
  constructor(
    private pokemonService: PokemonService,
    private cryService: CryService,
  ) {}

  private lastPreloadedGenId: number | null = null;

  async preloadForGeneration(genId: number): Promise<void> {
    // Avoid repeating heavy preloads.
    if (this.lastPreloadedGenId === genId) return;
    this.lastPreloadedGenId = genId;

    const urls = new Set<string>();

    // Local essentials (small but ensures instant playback/UI).
    urls.add('./click.mp3');
    urls.add('./ItemFound.mp3');
    urls.add('./PCTurningOn.mp3');
    urls.add('./PCLogin.mp3');
    urls.add('./PCLogout.mp3');
    urls.add('./place-holder-pixel.png');

    // Player sprites for this gen.
    // trainerSpriteData is typed with an index signature, so access via brackets.
    const player = (trainerSpriteData as any)[genId] as any;
    const male = player?.['male'];
    const female = player?.['female'];
    if (typeof male === 'string' && male) urls.add(male);
    if (typeof female === 'string' && female) urls.add(female);

    // Rival + battle trainer.
    for (const r of rivalByGeneration[genId] ?? []) {
      if ((r as any)?.sprite) urls.add((r as any).sprite);
    }

    for (const bt of battleTrainerByGeneration[genId] ?? []) {
      if (bt?.spriteUrl) urls.add(bt.spriteUrl);
    }

    // Gym leaders.
    for (const g of gymLeadersByGeneration[genId] ?? []) {
      if ((g as any)?.sprite) urls.add((g as any).sprite);
    }

    // Elite Four.
    for (const e of eliteFourByGeneration[genId] ?? []) {
      if ((e as any)?.sprite) urls.add((e as any).sprite);
    }

    // Champion.
    const champ = (championByGeneration as any)[genId];
    if (champ?.sprite) urls.add(champ.sprite);

    // Villain leaders (encounter + boss encounter).
    const villain = villainTeamByGeneration[genId];
    for (const leader of villain?.leaders ?? []) {
      if (leader?.spriteUrl) urls.add(leader.spriteUrl);
    }

    // Prefetch trainer sprites/audio first.
    await this.prefetchUrls(Array.from(urls));

    // Prefetch Mega cries early so they're cached by the time the roulette lands.
    // (Runs once per generation selection, but de-duping + SW cache keep it cheap.)
    try {
      const megaNames = await this.getMegaApiNamesToPrefetch();
      // CryService exposes a single-name prefetch. Fan/custom mega lists can be large,
      // so we run in parallel and swallow individual failures.
      await Promise.all(
        megaNames.map(async (n) => {
          try {
            await this.cryService.prefetchMegaCry(n);
          } catch {
            // ignore
          }
        })
      );
    } catch {
      // ignore (network / SW / parsing issues)
    }

    // Prefetch key Pokémon artwork that appears outside the random Pokédex:
    // - roadblock
    // - main legend(s) for the gen
    const roadblock = roadblockByGeneration[genId] ?? roadblockByGeneration[1];
    const legendaryIds = mainLegendaryIdsByGeneration[genId] ?? [];

    await this.preloadPokemonArtwork([roadblock?.pokemonId, ...legendaryIds].filter((n): n is number => typeof n === 'number' && n > 0));
  }

  private async getMegaApiNamesToPrefetch(): Promise<string[]> {
    const names = new Set<string>(OFFICIAL_MEGA_API_NAMES.map((n) => n.toLowerCase()));

    // Also include custom Mega/Primal definitions (so fan/custom forms benefit too).
    try {
      const resp = await fetch(new URL('data/custom-mega-forms.json', document.baseURI).toString(), { cache: 'no-cache' });
      if (resp.ok) {
        const json: any = await resp.json();
        const forms: any[] = Array.isArray(json?.forms) ? json.forms : [];
        for (const f of forms) {
            const apiName = (f?.apiName ?? '').toString().trim().toLowerCase();
            if (!apiName) continue;
            // Keep in sync with MegaEvolutionService.isMegaLikeVariety: Primal Reversion
            // and Ultra Burst count as Megas too.
            if (
              apiName.includes('-mega') ||
              apiName.endsWith('-primal') ||
              apiName.endsWith('-ultra') ||
              apiName.startsWith('mega-')
            ) {
              names.add(apiName);
            }
          }
      }
    } catch {
      // ignore
    }


    return Array.from(names);
  }

  private async preloadPokemonArtwork(pokemonIds: number[]): Promise<void> {
    // Deduplicate + keep reasonable.
    const ids = Array.from(new Set(pokemonIds)).slice(0, 50);

    for (const id of ids) {
      try {
        const res = await firstValueFrom(this.pokemonService.getPokemonSprites(id));
        const front = res?.sprite?.front_default || '';
        const shiny = res?.sprite?.front_shiny || '';
        const list = [front, shiny].filter(Boolean);
        if (list.length) {
          await this.prefetchUrls(list);
        }
      } catch {
        // Ignore failures (PokeAPI can rate limit).
      }
    }
  }

  private async prefetchUrls(urls: string[]): Promise<void> {
    const unique = Array.from(new Set((urls ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0)));
    if (!unique.length) return;

    // Prefer SW prefetch (it stores results in CacheStorage).
    if ('serviceWorker' in navigator) {
      try {
        // Wait for SW to be active.
        await navigator.serviceWorker.ready;

        const controller = navigator.serviceWorker.controller;
        if (controller) {
          await new Promise<void>((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();
            controller.postMessage({ type: 'PREFETCH', urls: unique }, [channel.port2]);
          });
          return;
        }
      } catch {
        // fall back below
      }
    }

    // Fallback: fetch directly (still helps warm browser HTTP cache).
    await this.windowFetchPrefetch(unique);
  }

  private async windowFetchPrefetch(urls: string[]): Promise<void> {
    const concurrency = 6;
    let idx = 0;

    const worker = async () => {
      while (idx < urls.length) {
        const i = idx++;
        const u = urls[i];
        try {
          // no-cors allows the request even if the host doesn't send CORS headers.
          const abs = new URL(u, window.location.href).toString();
          const isCross = new URL(abs).origin !== window.location.origin;
          await fetch(abs, isCross ? { mode: 'no-cors' } : undefined);
        } catch {
          // ignore
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  }
}
