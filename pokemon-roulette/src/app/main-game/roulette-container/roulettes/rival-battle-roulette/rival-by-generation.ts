import { GymLeader } from '../../../../interfaces/gym-leader';

/**
 * The one rival of each region.
 *
 * A person holds a single job in this game, so nobody here also appears on the Battle
 * Trainer wheel: N moved there (Hugh is Unova's rival), Hop moved there (Marnie is
 * Galar's), Hugh moved there, and Steven and Shauna moved there because they were never rivals at all —
 * Hoenn and Kalos make the rival the protagonist you did *not* pick, which is handled by
 * COUNTERPART_RIVAL_GENERATIONS below rather than by a fixed entry here.
 */
export const rivalByGeneration: Record<number, GymLeader[]> = {
  1: [
    {
      // Japanese/Adventures naming, as the Champion slot also uses.
      name: 'Green',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/green.png',
      quotes: ['Smell ya later!'],
    },
  ],
  2: [
    {
      name: 'Silver',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/silver.png',
      quotes: ['You’re not ready for this!'],
    },
  ],
  3: [
    {
      // Placeholder only: replaced at runtime by Brendan or May, whichever you are not.
      name: 'Brendan',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brendan.png',
      quotes: ['Let’s see how far your strength has grown.'],
    },
  ],
  4: [
    {
      name: 'Barry',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/barry.png',
      quotes: ['I am gonna fine you!'],
    },
  ],
  5: [
    {
      name: 'N',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/n.png',
      quotes: ['Let us see what your Pokemon can do.'],
    },
  ],
  6: [
    {
      // Placeholder only: replaced at runtime by Calem or Serena, whichever you are not.
      name: 'Calem',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/calem.png',
      quotes: ['Let us have a battle!'],
    },
  ],
  7: [
    {
      name: 'Gladion',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/gladion.png',
      quotes: ['I am not going easy on you.'],
    },
  ],
  8: [
    {
      name: 'Marnie',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/marnie.png',
      quotes: ['I will give it my all.'],
    },
  ],
  9: [
    {
      name: 'Nemona',
      sprite: 'https://play.pokemonshowdown.com/sprites/trainers/nemona-v.png',
      quotes: ['I have been waiting for this battle!'],
    },
  ],

};

/**
 * Regions whose rival is the protagonist of the other gender.
 *
 * Hoenn and Kalos pair you against your counterpart for the whole story, so the rival is
 * whichever of Brendan/May or Calem/Serena you did not choose to play as.
 */
export const COUNTERPART_RIVAL_GENERATIONS = [3, 6];
