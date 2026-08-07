import { Injectable } from '@angular/core';
import { SettingsService } from '../settings-service/settings.service';
import { nationalDexPokemon } from '../pokemon-service/national-dex-pokemon';

/**
 * Cry playback
 *
 * Sources used (in order):
 *  1) public/data/custom-cries.json (explicit URL overrides)
 *  2) public/cries/** (local overrides for GitHub Pages)
 *  3) PokeAPI cries by *form* id (this is what makes a Mega sound like the Mega)
 *  4) Veekun OGG cries (per National Dex number, some form suffixes)
 *  5) Base species cries (last resort, so a Mega is never silent)
 *
 * Notes:
 * - We do NOT call PokeAPI's REST API and do NOT use Pokemon Showdown as an audio source;
 *   the cry files are plain static assets on raw.githubusercontent.com.
 * - For Mega forms: we try a Mega-specific cry first; if unavailable we fall back to the base species cry
 *   (this avoids "no sound" for any Mega).
 */
@Injectable({
  providedIn: 'root',
})
export class CryService {
  // Optional local override directory (GitHub Pages-friendly).
  // Example: public/cries/mega/charizard-mega-x.(ogg|mp3|wav)
  private readonly localCryBase = new URL('cries', document.baseURI).toString().replace(/\/$/, '');

  // Veekun: per-form cry files as OGGs, keyed by National Dex number.
  // Example: https://veekun.com/dex/media/pokemon/cries/6-mega-x.ogg
  private readonly veekunCryBase = 'https://veekun.com/dex/media/pokemon/cries';

  // The PokeAPI cries repository. Files are keyed by PokeAPI *pokemon* id, which means
  // alternate forms have their own cry: 10034 = Mega Charizard X, 10077 = Primal Kyogre,
  // 10157 = Ultra Necrozma, ... Base species keep their National Dex number.
  // Example: https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg
  private readonly pokeApiCriesLatestBase =
    'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

  // A GitHub mirror of the same structure, kept as a last-resort fallback.
  private readonly githubCriesLatestBase =
    'https://raw.githubusercontent.com/pvcsam-repo-fork/cries-pokemon/main/cries/pokemon/latest';

  // Runtime overrides: public/data/custom-cries.json
  private customCryMapPromise: Promise<Record<string, string>> | null = null;

  // Audio unlock flag for mobile autoplay policies.
  private unlocked = false;

  // Name -> dexId index (built from our local dex list).
  private readonly nameToDexId = new Map<string, number>();

  constructor(private settings: SettingsService) {
    this.buildNameIndex();
  }

  private buildNameIndex(): void {
    for (const p of nationalDexPokemon) {
      if (typeof (p as any)?.text === 'string' && (p as any).text.startsWith('pokemon.')) {
        const key = (p as any).text.slice('pokemon.'.length);
        // Keep the first occurrence.
        if (!this.nameToDexId.has(key)) {
          this.nameToDexId.set(key, (p as any).pokemonId);
        }
      }
    }
  }

  /**
   * Call on first user interaction (pointerdown/click) to unlock audio on mobile browsers.
   * Safe to call many times.
   */
  async unlockAudio(): Promise<void> {
    if (this.unlocked) return;
    if (this.settings.currentSettings.muteAudio) return;

    try {
      const a = new Audio(new URL('silence.wav', document.baseURI).toString());
      a.volume = 0;
      await a.play().catch(() => {});
      this.unlocked = true;
    } catch {
      // ignore
    }
  }

  /**
   * Start warming cache while Mega Evolution animation plays.
   *
   * @param megaFormId PokeAPI id of the Mega/Primal/Ultra form (not the species id).
   */
  async prefetchMegaCry(megaApiName: string, megaFormId?: number): Promise<void> {
    const customMap = await this.loadCustomCryMap();
    const urls = this.buildMegaCryPrefetchUrls(megaApiName, customMap, megaFormId);
    this.prefetchUrls(urls);
  }


  /**
   * Finds the first candidate URL that actually has audio behind it.
   *
   * The candidate list is a priority order with a long tail of misses — public/cries/** is
   * an override directory that ships empty, so six guaranteed 404s used to be awaited one
   * after another before the real cry was even requested. Every candidate is now loaded at
   * once and then *awaited* in priority order, so discovery costs one round trip instead of
   * one per miss, and the best available source still wins.
   *
   * Returns an element already buffered to `canplaythrough`, so playback starts instantly.
   */
  async resolvePlayableCry(megaApiName: string, megaFormId?: number): Promise<HTMLAudioElement | null> {
    if (this.settings.currentSettings.muteAudio) return null;

    const customMap = await this.loadCustomCryMap();
    const urls = Array.from(
      new Set(this.buildMegaCryPrefetchUrls(megaApiName, customMap, megaFormId).filter(Boolean))
    );
    if (!urls.length) return null;

    const probes = urls.map((url) => this.loadAudio(url));
    const winners: HTMLAudioElement[] = [];

    let chosen: HTMLAudioElement | null = null;
    for (const probe of probes) {
      const audio = await probe;
      if (!audio) continue;
      if (!chosen) chosen = audio;
      else winners.push(audio);
    }

    // Release the runners-up so they stop buffering.
    for (const spare of winners) {
      try {
        spare.src = '';
      } catch {
        // ignore
      }
    }

    return chosen;
  }

  /** Buffers a URL, resolving to the element when it can play or null when it cannot. */
  private loadAudio(url: string, timeoutMs = 6000): Promise<HTMLAudioElement | null> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
        if (!ok) {
          try {
            audio.src = '';
          } catch {
            // ignore
          }
        }
        resolve(ok ? audio : null);
      };

      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(() => finish(false), timeoutMs);

      audio.addEventListener('canplaythrough', onReady);
      audio.addEventListener('error', onError);

      try {
        audio.src = url;
        audio.load();
      } catch {
        finish(false);
      }
    });
  }

  /** Plays an element returned by resolvePlayableCry(), resolving when the cry ends. */
  playResolvedCry(audio: HTMLAudioElement): Promise<void> {
    return this.playLoaded(audio);
  }

  /** Plays an already-buffered element and resolves when it finishes. */
  private playLoaded(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        audio.removeEventListener('ended', finish);
        audio.removeEventListener('error', finish);
        resolve();
      };

      // A cry is a second or two; this only guards against an element that never ends.
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.ceil(audio.duration * 1000) + 1000
        : 8000;
      const timer = window.setTimeout(finish, durationMs);

      audio.addEventListener('ended', finish);
      audio.addEventListener('error', finish);

      try {
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => finish());
      } catch {
        finish();
      }
    });
  }

  // ------------------------------------------------------------
  // Custom cry map
  // ------------------------------------------------------------

  private async loadCustomCryMap(): Promise<Record<string, string>> {
    if (this.customCryMapPromise) return this.customCryMapPromise;

    this.customCryMapPromise = (async () => {
      try {
        const res = await fetch(new URL('data/custom-cries.json', document.baseURI).toString(), { cache: 'no-cache' });
        if (!res.ok) return {};
        const json = await res.json();
        if (!json || typeof json !== 'object') return {};
        return (json as any).cries && typeof (json as any).cries === 'object' ? (json as any).cries : {};
      } catch {
        return {};
      }
    })();

    return this.customCryMapPromise;
  }

  // ------------------------------------------------------------
  // URL building
  // ------------------------------------------------------------

  private buildMegaCryPrefetchUrls(
    megaApiName: string,
    customMap: Record<string, string>,
    megaFormId?: number
  ): string[] {
    const baseName = this.deriveBaseSpeciesName(megaApiName);
    const dexId = this.getDexIdForName(megaApiName) ?? this.getDexIdForName(baseName);

    const megaKey = this.toCanonicalCryKey(megaApiName);
    const baseKey = this.toCanonicalCryKey(baseName);

    const customMega = customMap?.[megaApiName] || customMap?.[megaKey] || '';
    const customBase = customMap?.[baseName] || customMap?.[baseKey] || '';

    const urls: string[] = [];

    // --- Mega form (prefer form-specific) ---
    if (customMega) urls.push(customMega);

    // Local overrides
    urls.push(`${this.localCryBase}/mega/${megaApiName}.mp3`);
    urls.push(`${this.localCryBase}/mega/${megaApiName}.ogg`);
    urls.push(`${this.localCryBase}/mega/${megaApiName}.wav`);
    if (megaKey !== megaApiName) {
      urls.push(`${this.localCryBase}/mega/${megaKey}.mp3`);
      urls.push(`${this.localCryBase}/mega/${megaKey}.ogg`);
      urls.push(`${this.localCryBase}/mega/${megaKey}.wav`);
    }

    // Cry of the *form* itself, keyed by its PokeAPI id.
    // This is the one that makes Mega Charizard X / Primal Kyogre / Ultra Necrozma sound
    // like themselves — without it every Mega falls through to the base species cry below.
    if (typeof megaFormId === 'number' && megaFormId > 0 && megaFormId !== dexId) {
      urls.push(`${this.pokeApiCriesLatestBase}/${megaFormId}.ogg`);
      urls.push(`${this.githubCriesLatestBase}/${megaFormId}.ogg`);
    }

    // Veekun Mega-form OGG (if we can resolve a dex id and a known suffix)
    if (dexId != null) {
      const suffix = this.resolveCryFormSuffix(megaApiName);
      if (suffix) {
        urls.push(`${this.veekunCryBase}/${dexId}${suffix}.ogg`);
      }
    }

    // --- Base species fallback (guarantee a cry plays) ---
    if (customBase) urls.push(customBase);

    urls.push(`${this.localCryBase}/base/${baseName}.mp3`);
    urls.push(`${this.localCryBase}/base/${baseName}.ogg`);
    urls.push(`${this.localCryBase}/base/${baseName}.wav`);
    if (baseKey !== baseName) {
      urls.push(`${this.localCryBase}/base/${baseKey}.mp3`);
      urls.push(`${this.localCryBase}/base/${baseKey}.ogg`);
      urls.push(`${this.localCryBase}/base/${baseKey}.wav`);
    }

    if (dexId != null) {
      // Veekun base
      urls.push(`${this.veekunCryBase}/${dexId}.ogg`);
      // PokeAPI base cry, then the mirror
      urls.push(`${this.pokeApiCriesLatestBase}/${dexId}.ogg`);
      urls.push(`${this.githubCriesLatestBase}/${dexId}.ogg`);
    }

    return urls;
  }

  /**
   * A deterministic, filesystem-friendly cry key.
   * (Historically this matches the Showdown naming conventions, but we don't depend on Showdown as a source.)
   */
  private toCanonicalCryKey(apiName: string): string {
    let s = (apiName || '').toLowerCase();
    // Common punctuation normalization
    s = s.replace(/[':.]/g, '');
    // Collapse some known awkward names
    s = s.replace(/mr-mime/g, 'mrmime');
    s = s.replace(/mime-jr/g, 'mimejr');
    s = s.replace(/porygon-z/g, 'porygonz');

    // Megas in some sources use "-megax" instead of "-mega-x".
    s = s.replace(/-mega-x/g, '-megax');
    s = s.replace(/-mega-y/g, '-megay');

    return s;
  }

  /**
   * Resolve our local National Dex id for a given form name.
   *
   * Strategy:
   * - Try exact match (if the apiName happens to be a base species name).
   * - Otherwise, progressively strip trailing "-segment" parts until it matches a known base species.
   */
  private getDexIdForName(formName: string): number | null {
    if (!formName) return null;

    let candidate = formName.toLowerCase();
    if (this.nameToDexId.has(candidate)) return this.nameToDexId.get(candidate)!;

    while (candidate.includes('-')) {
      candidate = candidate.slice(0, candidate.lastIndexOf('-'));
      if (this.nameToDexId.has(candidate)) return this.nameToDexId.get(candidate)!;
    }

    return null;
  }

  /**
   * Extract a base-species name from a form apiName.
   */
  private deriveBaseSpeciesName(formApiName: string): string {
    const s = (formApiName || '').toLowerCase();

    // Try explicit Mega patterns first
    if (s.endsWith('-mega-x')) return s.slice(0, -'-mega-x'.length);
    if (s.endsWith('-mega-y')) return s.slice(0, -'-mega-y'.length);
    if (s.endsWith('-mega-z')) return s.slice(0, -'-mega-z'.length);
    if (s.endsWith('-mega')) return s.slice(0, -'-mega'.length);

    // Other special forms we allow (keep consistent behavior)
    if (s.endsWith('-primal')) return s.slice(0, -'-primal'.length);
    if (s.endsWith('-origin')) return s.slice(0, -'-origin'.length);
    if (s.endsWith('-eternamax')) return s.slice(0, -'-eternamax'.length);
    if (s.endsWith('-terastal')) return s.slice(0, -'-terastal'.length);
    if (s.endsWith('-stellar')) return s.slice(0, -'-stellar'.length);

    return s;
  }

  /**
   * Veekun form suffixes we support.
   */
  private resolveCryFormSuffix(formApiName: string): string {
    const s = (formApiName || '').toLowerCase();

    if (s.endsWith('-mega-x')) return '-mega-x';
    if (s.endsWith('-mega-y')) return '-mega-y';
    // "Mega Z" isn't a Veekun-specific suffix; use the base Mega cry.
    if (s.endsWith('-mega-z')) return '-mega';
    if (s.endsWith('-mega')) return '-mega';

    if (s.endsWith('-primal')) return '-primal';
    if (s.endsWith('-origin')) return '-origin';

    // If it's not a known veekun suffix, return '' so we skip the per-form URL.
    return '';
  }

  // ------------------------------------------------------------
  // Prefetch
  // ------------------------------------------------------------

  private prefetchUrls(urls: string[]): void {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    if (!unique.length) return;

    // Prefer Service Worker cache if available.
    try {
      const ctrl = navigator?.serviceWorker?.controller;
      if (ctrl) {
        ctrl.postMessage({ type: 'PREFETCH', urls: unique });
        return;
      }
    } catch {
      // ignore
    }

    // Fallback: warm browser cache.
    for (const url of unique) {
      try {
        fetch(url, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  // ------------------------------------------------------------
  // Playback
  // ------------------------------------------------------------

}
