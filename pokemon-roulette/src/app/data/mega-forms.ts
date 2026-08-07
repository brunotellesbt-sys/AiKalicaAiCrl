/**
 * Shared rules for "Mega" forms.
 *
 * Used by both MegaEvolutionService (which decides what the Mega roulette can offer)
 * and the Pokédex screen (which lists them), so the two can never disagree about what
 * counts as a Mega or how it is spelled.
 */

/**
 * Which PokeAPI form names count as a "Mega Evolution" for this game.
 *
 * Besides real Mega forms, Primal Reversion (Kyogre/Groudon) and Ultra Burst
 * (Necrozma) are treated as Megas: same one-per-battle rule, same roulette.
 */
export function isMegaLikeFormName(formName: string): boolean {
  const name = (formName ?? '').toLowerCase();

  // IMPORTANT: "mega" must be a hyphen-delimited form segment ("-mega", "-mega-x", etc.).
  // Otherwise Pokémon whose base name contains the substring "mega" (e.g. "meganium")
  // would be incorrectly treated as having a Mega form.
  if (name.includes('-mega')) return true;

  // "kyogre-primal" / "groudon-primal" and "necrozma-ultra".
  return name.endsWith('-primal') || name.endsWith('-ultra');
}

/** "charizard-mega-x" -> "Mega Charizard X", "kyogre-primal" -> "Primal Kyogre". */
export function formatMegaFormDisplayName(apiName: string): string {
  const parts = (apiName ?? '').split('-').filter(Boolean);
  if (parts.length === 0) return '';

  // Primal Reversion and Ultra Burst read prefix-first: "Primal Kyogre", "Ultra Necrozma".
  const formWord = parts[parts.length - 1];
  if (parts.length === 2 && (formWord === 'primal' || formWord === 'ultra')) {
    return `${capitalize(formWord)} ${toTitleCase(parts[0])}`;
  }

  const megaIndex = parts.indexOf('mega');
  if (megaIndex === -1) {
    return toTitleCase(parts.join(' '));
  }

  const baseName = parts.slice(0, megaIndex).join(' ');
  const suffix = parts
    .slice(megaIndex + 1)
    .map((p) => (['x', 'y', 'z'].includes(p) ? p.toUpperCase() : capitalize(p)))
    .join(' ');

  return `Mega ${toTitleCase(baseName)}${suffix ? ` ${suffix}` : ''}`;
}

/** Bulbapedia anchors differ per transformation type. */
export function bulbapediaAnchorForMegaLike(apiName: string): string {
  const name = (apiName ?? '').toLowerCase();
  if (name.endsWith('-primal')) return 'Primal_Reversion';
  if (name.endsWith('-ultra')) return 'Ultra_Burst';
  return 'Mega_Evolution';
}

function toTitleCase(str: string): string {
  return str.split(' ').filter(Boolean).map(capitalize).join(' ');
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
