import { WheelItem } from "./wheel-item";

export interface PokemonItem extends WheelItem {
  pokemonId: number;
  /**
   * Optional National Dex / base species id for forms.
   *
   * Example: Hisuian Growlithe (pokemonId 10229) has basePokemonId 58.
   *
   * This is useful when we need to query species data (mega evolutions, etc.).
   */
  basePokemonId?: number;
  sprite: {
    front_default: string;
    front_shiny: string;
  } | null;
  shiny: boolean;
  power: 1 | 2 | 3 | 4 | 5 | 6;

  /** Battle-only flags (e.g., Mega Evolution). */
  isMegaEvolved?: boolean;
  /**
   * PokeAPI id of the Mega/Primal/Ultra form currently active.
   *
   * Kept separately from pokemonId (which stays the base species) because these forms can
   * change typing — Mega Charizard X becomes Fire/Dragon — and the Type Advantage mode has
   * to score the form that is actually on the field.
   */
  megaFormId?: number;
  megaBackup?: {
    text: string;
    sprite: {
      front_default: string;
      front_shiny: string;
    } | null;
    power: 1 | 2 | 3 | 4 | 5 | 6;
  };
}