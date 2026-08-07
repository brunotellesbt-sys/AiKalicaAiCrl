import { Directive, HostListener } from '@angular/core';

/**
 * Prevents "broken image" blanks by swapping the <img> src to a fallback URL when it fails.
 * This is intentionally heuristic-based so we don't have to touch every data file.
 *
 * Rules of thumb:
 * - Never fall back to a *different* character/Pokémon. A wrong picture is worse than
 *   a placeholder, so fallbacks only ever try other renditions of the same subject.
 * - Never fall back to archives.bulbagarden.net: it answers 403 to browser requests
 *   (hotlink protection), so those URLs can only ever waste a round trip.
 */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  private tried = new Set<string>();

  @HostListener('error', ['$event'])
  onError(event: Event) {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;

    const current = img.currentSrc || img.src || '';
    if (current) this.tried.add(current);

    const next = this.getNextFallback(current);
    if (!next) return;

    // avoid loops
    if (this.tried.has(next)) return;
    this.tried.add(next);

    img.src = next;
  }

  private getNextFallback(src: string): string | null {
    const placeholder = './place-holder-pixel.png';

    // Empty / undefined src => placeholder
    if (!src || src === 'undefined' || src.endsWith('/undefined')) {
      return placeholder;
    }

    const first = (candidates: string[]) => {
      for (const c of candidates) {
        if (c && c !== src && !this.tried.has(c)) return c;
      }
      return placeholder;
    };

    // ===== Pokémon form sprites (Showdown) =====
    // Mega/Primal/Ultra forms are added to Showdown's dex before the static artwork
    // exists, so /dex and /dex-shiny 404 for the newest ones while /ani already has a
    // GIF. Walk that chain before giving up.
    const showdownForm = this.extractShowdownForm(src);
    if (showdownForm) {
      return first([
        `https://play.pokemonshowdown.com/sprites/dex/${showdownForm}.png`,
        `https://play.pokemonshowdown.com/sprites/ani/${showdownForm}.gif`,
        `https://play.pokemonshowdown.com/sprites/gen5/${showdownForm}.png`,
        placeholder,
      ]);
    }

    // ===== Trainer images =====
    // Showdown keeps generation-specific variants of some trainers (e.g. "maxie-gen6").
    // Try the sibling spelling of the *same* trainer, never a different one.
    const showdownTrainer = this.extractShowdownTrainer(src);
    if (showdownTrainer) {
      const bare = showdownTrainer.replace(/-(gen\d|s)$/, '');
      return first([
        `https://play.pokemonshowdown.com/sprites/trainers/${bare}-gen6.png`,
        `https://play.pokemonshowdown.com/sprites/trainers/${bare}-gen4.png`,
        `https://play.pokemonshowdown.com/sprites/trainers/${bare}.png`,
        placeholder,
      ]);
    }

    // ===== Pokémon images =====
    // Attempt to swap between PokeAPI sprite variants if something fails.
    const pokeId = this.extractPokemonId(src);
    if (pokeId) {
      return first([
        // Prefer official artwork, then standard sprites.
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`,
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`,
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokeId}.png`,
        placeholder,
      ]);
    }

    // ===== Items / badges / misc =====
    // If a "known" external asset fails, show placeholder rather than a broken icon.
    return placeholder;
  }

  /** "…/sprites/dex-shiny/charizard-megax.png" => "charizard-megax" */
  private extractShowdownForm(src: string): string | null {
    const m = src.match(
      /play\.pokemonshowdown\.com\/sprites\/(?:dex|dex-shiny|ani|ani-shiny|gen5|gen5-shiny|home|home-shiny)\/([a-z0-9-]+)\.(?:png|gif)/i
    );
    return m ? m[1].toLowerCase() : null;
  }

  /** "…/sprites/trainers/maxie-gen6.png" => "maxie-gen6" */
  private extractShowdownTrainer(src: string): string | null {
    const m = src.match(/play\.pokemonshowdown\.com\/sprites\/trainers\/([a-z0-9-]+)\.png/i);
    return m ? m[1].toLowerCase() : null;
  }

  private extractPokemonId(src: string): number | null {
    // Matches .../pokemon/906.png, .../pokemon/shiny/906.png, ...official-artwork/906.png
    const m = src.match(/\/pokemon\/(?:other\/official-artwork\/)?(\d+)\.png/i)
          || src.match(/\/pokemon\/shiny\/(\d+)\.png/i)
          || src.match(/official-artwork\/(\d+)\.png/i);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
  }
}
