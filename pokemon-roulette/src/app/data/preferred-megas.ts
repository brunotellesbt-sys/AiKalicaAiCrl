/**
 * Mega forms pinned to a specific trainer.
 *
 * Some opponents are defined by one variant rather than by the species. Ash and Yellow both
 * carry the Pikachu line, and Raichu has two Legends Z-A Megas — giving them one each keeps
 * the pair distinct instead of fielding the same Mega twice.
 *
 * Keyed by the name shown on screen; the value is the PokeAPI form name.
 */
export const preferredMegaByTrainer: Record<string, string> = {
  Ash: 'raichu-mega-y',
  Yellow: 'raichu-mega-x',
};

/** '' when the trainer has no pinned form, which is the normal case. */
export function preferredMegaFor(trainerName: string): string {
  return preferredMegaByTrainer[trainerName] ?? '';
}
