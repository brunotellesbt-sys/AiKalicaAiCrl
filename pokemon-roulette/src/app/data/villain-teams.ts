/**
 * Villain organisations, one entry per team rather than one per region.
 *
 * Hoenn is why this shape exists: Magma and Aqua are two organisations with opposing goals,
 * and the old data folded them into a single region entry called "Team Magma / Team Aqua"
 * with two leaders. That made them indistinguishable to everything downstream — the run
 * could not say which one it had just fought, so it could not hold what each of them stole
 * separately either.
 *
 * A region now owns a list of teams. Most have exactly one; Hoenn has two, and a run rolls
 * for which shows up at each encounter.
 */

const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/trainers';

export interface VillainGrunt {
  /** Display name; the rank rather than a person, because that is what a grunt is. */
  name: string;
  spriteUrl: string;
}

export interface VillainTeam {
  /** Stable key. Stolen Pokémon are filed under this, so it must not change casually. */
  id: string;
  name: string;
  /**
   * The team's colour, used wherever the run has to say which one you are dealing with.
   *
   * Rocket's is black in Kanto and stays black in Johto — the Johto outfit differs but the
   * organisation does not, and recolouring it would suggest a different group.
   */
  colour: string;
  /** Shown only at the region's boss encounter. */
  boss: {
    name: string;
    spriteUrl: string;
    blurb: string;
  };
  /**
   * Rank and file, met on the road.
   *
   * The boss used to turn up at every roadside mugging, which made the one fight that is
   * supposed to be the region's climax feel like the fourth time you had seen them. Grunts
   * are drawn from here instead, and the boss is held back for the boss battle.
   */
  grunts: VillainGrunt[];
}

/**
 * Grunt sprites follow Showdown's naming, the same source the boss sprites already use.
 *
 * NOTE: these particular filenames could not be verified from the environment this was
 * written in — outbound requests to play.pokemonshowdown.com are blocked there. Any that
 * turn out wrong render through the image fallback directive as a placeholder rather than
 * a broken image, and are a one-line correction here.
 */
function grunts(prefix: string, labels: [string, string] = ['Grunt', 'Grunt']): VillainGrunt[] {
  return [
    { name: labels[0], spriteUrl: `${SHOWDOWN}/${prefix}.png` },
    { name: labels[1], spriteUrl: `${SHOWDOWN}/${prefix}f.png` },
  ];
}

export const villainTeamsByGeneration: Record<number, VillainTeam[]> = {
  1: [
    {
      id: 'rocket-kanto',
      name: 'Team Rocket',
      colour: '#1b1b1b',
      boss: {
        name: 'Giovanni',
        spriteUrl: `${SHOWDOWN}/giovanni.png`,
        blurb: 'The boss of Team Rocket. Beware!',
      },
      grunts: grunts('rocketgrunt'),
    },
  ],
  2: [
    {
      // Same organisation, different era — filed separately so a Johto run's losses are not
      // handed back by a Kanto run's boss, but kept on Rocket's colour because it is Rocket.
      id: 'rocket-johto',
      name: 'Team Rocket',
      colour: '#1b1b1b',
      boss: {
        name: 'Proton',
        spriteUrl: `${SHOWDOWN}/proton.png`,
        blurb: 'A Team Rocket executive is causing trouble.',
      },
      grunts: grunts('rocketgruntgen2'),
    },
  ],
  3: [
    {
      id: 'magma',
      name: 'Team Magma',
      colour: '#b03a2e',
      boss: {
        name: 'Maxie',
        // Showdown has no plain "maxie.png"; the ORAS sprite is the -gen6 variant.
        spriteUrl: `${SHOWDOWN}/maxie-gen6.png`,
        blurb: 'Team Magma wants to expand the land.',
      },
      grunts: grunts('magmagrunt'),
    },
    {
      id: 'aqua',
      name: 'Team Aqua',
      colour: '#2471a3',
      boss: {
        name: 'Archie',
        spriteUrl: `${SHOWDOWN}/archie-gen6.png`,
        blurb: 'Team Aqua wants to expand the sea.',
      },
      grunts: grunts('aquagrunt'),
    },
  ],
  4: [
    {
      id: 'galactic',
      name: 'Team Galactic',
      colour: '#7d3c98',
      boss: {
        name: 'Cyrus',
        spriteUrl: `${SHOWDOWN}/cyrus.png`,
        blurb: "Team Galactic's cold and calculating leader.",
      },
      grunts: grunts('galacticgrunt'),
    },
  ],
  5: [
    {
      id: 'plasma',
      name: 'Team Plasma',
      colour: '#5d6d7e',
      boss: {
        name: 'Ghetsis',
        spriteUrl: `${SHOWDOWN}/ghetsis.png`,
        blurb: 'Team Plasma preaches liberation, and means something else.',
      },
      grunts: grunts('plasmagrunt'),
    },
  ],
  6: [
    {
      id: 'flare',
      name: 'Team Flare',
      colour: '#cb4335',
      boss: {
        name: 'Lysandre',
        spriteUrl: `${SHOWDOWN}/lysandre.png`,
        blurb: 'Team Flare wants a beautiful world, for very few people.',
      },
      grunts: grunts('flaregrunt'),
    },
  ],
  7: [
    {
      id: 'skull',
      name: 'Team Skull',
      colour: '#8e44ad',
      boss: {
        name: 'Guzma',
        spriteUrl: `${SHOWDOWN}/guzma.png`,
        blurb: 'Team Skull is here to ruin your day.',
      },
      grunts: grunts('skullgrunt'),
    },
  ],
  8: [
    {
      id: 'macro',
      name: 'Macro Cosmos',
      colour: '#1f618d',
      boss: {
        name: 'Chairman Rose',
        spriteUrl: `${SHOWDOWN}/rose.png`,
        blurb: 'A corporate villain shows up at the worst time.',
      },
      grunts: grunts('macrocosmos'),
    },
  ],
  9: [
    {
      id: 'star',
      name: 'Team Star',
      colour: '#d4ac0d',
      boss: {
        name: 'Cassiopeia',
        spriteUrl: `${SHOWDOWN}/cassiopeia.png`,
        blurb: 'Team Star runs the schoolyard, or thinks it does.',
      },
      grunts: grunts('stargrunt'),
    },
  ],
};

/** Every team that can show up in a region. Hoenn returns two; everywhere else, one. */
export function teamsForGeneration(generationId: number): VillainTeam[] {
  return villainTeamsByGeneration[generationId] ?? [];
}

/** True where the run has to ask which organisation turned up. */
export function hasRivalTeams(generationId: number): boolean {
  return teamsForGeneration(generationId).length > 1;
}
