import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

function titleCaseFromToken(token: string): string {
  return (token || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Makes any missing translation look human-friendly so we never show raw keys like
 * "items.super-potion.name" on screen.
 */
@Injectable({ providedIn: 'root' })
export class PrettyMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    const key = (params?.key ?? '').toString();

    // items.super-potion.name -> Super Potion
    const itemName = key.match(/^items\.(.+)\.name$/);
    if (itemName?.[1]) return titleCaseFromToken(itemName[1]);

    // items.super-potion.description -> (same fallback)
    const itemDesc = key.match(/^items\.(.+)\.description$/);
    if (itemDesc?.[1]) return titleCaseFromToken(itemDesc[1]);

    // pokemon.meganium -> Meganium
    const poke = key.match(/^pokemon\.(.+)$/);
    if (poke?.[1]) return titleCaseFromToken(poke[1]);

    // trainers.xxx or rivals.xxx etc -> last segment
    const lastSegment = key.split('.').pop() || key;
    return titleCaseFromToken(lastSegment);
  }
}
