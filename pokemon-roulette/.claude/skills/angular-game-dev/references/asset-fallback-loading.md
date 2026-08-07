# Asset loading with fallback

Games that pull sprites/images from external URLs (a public sprite API, a CDN, user-generated content) will hit broken/missing images in production even when everything works in dev. Handle this with a reusable `HostListener('error')` directive, not a try/catch per `<img>` usage site.

## The pattern

```ts
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

    if (this.tried.has(next)) return; // avoid infinite error-loop
    this.tried.add(next);
    img.src = next;
  }

  private getNextFallback(src: string): string | null {
    const placeholder = './place-holder-pixel.png';

    if (!src || src === 'undefined' || src.endsWith('/undefined')) {
      return placeholder;
    }

    // Per-asset-type candidate chains: recognize the URL pattern and
    // try the next-best source for THAT kind of asset specifically.
    const id = this.extractId(src);
    if (id) {
      const candidates = [
        `https://example-cdn.com/sprites/official-artwork/${id}.png`,
        `https://example-cdn.com/sprites/standard/${id}.png`,
        placeholder
      ];
      for (const c of candidates) {
        if (c !== src && !this.tried.has(c)) return c;
      }
    }

    return placeholder; // unrecognized asset type: just avoid a broken-image icon
  }

  private extractId(src: string): number | null {
    const m = src.match(/\/sprites\/[a-z-]+\/(\d+)\.png/i);
    return m ? Number(m[1]) : null;
  }
}
```

```html
<img [src]="pokemon.spriteUrl" appImgFallback alt="{{ pokemon.name }}" />
```

## Why this shape specifically

- **A directive, not a wrapper component.** Any `<img>` anywhere in the app gets the behavior by adding one attribute — no need to route every image through a shared component.
- **The `tried` Set prevents infinite error loops.** If the fallback ALSO 404s, the browser fires `error` again — without tracking what's already been attempted, this can loop or bounce between two URLs forever.
- **Match on URL *shape*, not a single hardcoded fallback.** Different asset types (character sprites vs. item icons vs. trainer art) usually live at different URL patterns and should fall back to *their own* next-best source, not all collapse to one generic placeholder immediately. Recognize the pattern, build a small ordered candidate list for that pattern, fall through the list, and only use the placeholder once every real candidate has been tried.
- **Always end the chain with a local placeholder asset**, not another remote URL — the last fallback should never itself be able to fail from a network condition.

## When to reach for this

Any time image `src` values are computed from external data (an ID, a name, a user-provided URL) rather than bundled build assets — those are exactly the ones that can 404 in production for reasons dev testing won't surface (rate limits, renamed files upstream, a typo'd ID from a data table). If every sprite in the game comes from your own bundled `assets/` folder, this pattern is unnecessary — a build-time missing asset is a build error, not a runtime one.
