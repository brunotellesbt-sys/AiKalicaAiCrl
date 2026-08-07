import { PokemonType } from './type-chart';

/**
 * Type theme of every scripted opponent, per generation.
 *
 * This is what the Type Advantage mode builds enemy teams from: instead of hand-listing
 * ~700 canonical roster entries (which nothing here can verify), each opponent declares
 * the types they specialise in, and the enemy team is drawn from the Pokémon of those
 * types that actually exist in the generation being played. That keeps every opponent
 * consistent with the region on screen.
 *
 * Order matches the arrays in gym-leaders-by-generation.ts / elite-four-by-generation.ts.
 * An empty array means "no theme" — used for Champions, who canonically field mixed teams
 * and therefore should not have an exploitable weakness.
 */

/** 8 gym leaders per generation, in gym order. */
export const gymLeaderTypesByGeneration: Record<number, PokemonType[][]> = {
  // Kanto: Brock, Misty, Surge, Erika, Koga, Sabrina, Blaine, Giovanni
  1: [['rock'], ['water'], ['electric'], ['grass'], ['poison'], ['psychic'], ['fire'], ['ground']],
  // Johto: Falkner, Bugsy, Whitney, Morty, Chuck, Jasmine, Pryce, Clair
  2: [['flying'], ['bug'], ['normal'], ['ghost'], ['fighting'], ['steel'], ['ice'], ['dragon']],
  // Hoenn: Roxanne, Brawly, Wattson, Flannery, Norman, Winona, Liza & Tate, Juan
  3: [['rock'], ['fighting'], ['electric'], ['fire'], ['normal'], ['flying'], ['psychic'], ['water']],
  // Sinnoh: Roark, Gardenia, Maylene, Crasher Wake, Fantina, Byron, Candice, Volkner
  4: [['rock'], ['grass'], ['fighting'], ['water'], ['ghost'], ['steel'], ['ice'], ['electric']],
  // Unova: Striaton trio, Lenora, Burgh, Elesa, Clay, Skyla, Brycen, Drayden/Iris
  5: [['grass', 'fire', 'water'], ['normal'], ['bug'], ['electric'], ['ground'], ['flying'], ['ice'], ['dragon']],
  // Kalos: Viola, Grant, Korrina, Ramos, Clemont, Valerie, Olympia, Wulfric
  6: [['bug'], ['rock'], ['fighting'], ['grass'], ['electric'], ['fairy'], ['psychic'], ['ice']],
  // Alola trials: Ilima, Hala, Lana/Kiawe/Mallow, Olivia, Sophocles/Acerola, Nanu, Mina, Hapu
  7: [['normal'], ['fighting'], ['water', 'fire', 'grass'], ['rock'], ['electric', 'ghost'], ['dark'], ['fairy'], ['ground']],
  // Galar: Milo, Nessa, Kabu, Bea/Allister, Bede, Gordie/Melony, Piers, Raihan
  8: [['grass'], ['water'], ['fire'], ['fighting', 'ghost'], ['fairy'], ['rock', 'ice'], ['dark'], ['dragon']],
  // Paldea: Katy, Brassius, Iono, Kofu, Larry, Ryme, Tulip, Grusha
  9: [['bug'], ['grass'], ['electric'], ['water'], ['normal'], ['ghost'], ['psychic'], ['ice']],
};

/** 4 Elite Four members per generation, in challenge order. */
export const eliteFourTypesByGeneration: Record<number, PokemonType[][]> = {
  1: [['ice'], ['fighting'], ['ghost'], ['dragon']],            // Lorelei, Bruno, Agatha, Lance
  2: [['psychic'], ['poison'], ['fighting'], ['dark']],         // Will, Koga, Bruno, Karen
  3: [['dark'], ['ghost'], ['ice'], ['dragon']],                // Sidney, Phoebe, Glacia, Drake
  4: [['bug'], ['ground'], ['fire'], ['psychic']],              // Aaron, Bertha, Flint, Lucian
  5: [['ghost'], ['fighting'], ['dark'], ['psychic']],          // Shauntal, Marshal, Grimsley, Caitlin
  6: [['fire'], ['water'], ['steel'], ['dragon']],              // Malva, Siebold, Wikstrom, Drasna
  7: [['steel'], ['rock'], ['ghost'], ['flying']],              // Molayne, Olivia, Acerola, Kahili
  8: [['dark'], ['water'], ['fighting'], ['dragon']],           // Marnie, Nessa, Bea, Raihan
  // Larry's Elite Four specialty is Flying, not the Normal he runs the Medali Gym with —
  // the split is the whole joke of the character, and a tournament folds both into him.
  9: [['ground'], ['fairy'], ['flying'], ['dragon']],           // Rika, Poppy, Larry, Hassel
};

/**
 * Champions field deliberately mixed teams, so they get no theme — their squad is drawn
 * from the strongest Pokémon of the generation regardless of type. No free counter.
 */
export const championTypesByGeneration: Record<number, PokemonType[]> = {
  1: [], 2: ['dragon'], 3: ['water'], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [],
};

/**
 * Villain team bosses, by generation.
 * Rockets lean Poison/Dark, Magma Fire/Ground, Aqua Water, Galactic mixed, etc.
 */
export const villainBossTypesByGeneration: Record<number, PokemonType[]> = {
  1: ['poison', 'ground'],
  2: ['poison', 'dark'],
  3: ['fire', 'water', 'ground'],
  4: ['dark', 'poison'],
  5: ['dark'],
  6: ['poison', 'dark'],
  7: ['poison', 'normal'],
  8: ['steel', 'dragon'],
  9: ['dark', 'fighting'],
};

/** Rivals and roadside trainers have no fixed specialty — mixed, like the player. */
export const RIVAL_TYPES: PokemonType[] = [];
export const BATTLE_TRAINER_TYPES: PokemonType[] = [];
