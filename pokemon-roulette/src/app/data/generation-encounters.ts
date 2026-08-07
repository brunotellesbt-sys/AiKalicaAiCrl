export interface EncounterCharacter {
  name: string;
  spriteUrl: string;
  blurb: string;
}

export interface VillainTeamEncounter {
  teamName: string;
  leaders: EncounterCharacter[];
  blurb: string;
}

export interface RoadblockEncounter {
  pokemonId: number;
  pokemonNameKey: string;
  blurb: string;
}

const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/trainers';

/**
 * The notable trainers each region lets you battle, spun for on a wheel.
 *
 * Nobody here is also the region's rival — a person holds one job. Hugh sits here because N
 * is Unova's rival; Hop and Bede sit here because Marnie is Galar's; Steven and Shauna sit
 * here because they were never rivals to begin with. The protagonist you did not pick is
 * added on top of this list at runtime, from protagonistCharacterByGeneration.
 */
export const battleTrainerByGeneration: Record<number, EncounterCharacter[]> = {
  1: [
    { name: 'Yellow', spriteUrl: `${SHOWDOWN}/yellow.png`, blurb: 'trainer.blurb.yellow' },
    { name: 'Ash', spriteUrl: `${SHOWDOWN}/ash.png`, blurb: 'trainer.blurb.ash' },
  ],
  2: [
    { name: 'Eugene', spriteUrl: `${SHOWDOWN}/eusine.png`, blurb: 'trainer.blurb.eugene' },
  ],
  3: [
    { name: 'Wally', spriteUrl: `${SHOWDOWN}/wally.png`, blurb: 'trainer.blurb.wally' },
    { name: 'Steven', spriteUrl: `${SHOWDOWN}/steven.png`, blurb: 'trainer.blurb.steven' },
  ],
  4: [
    {
      name: 'Looker',
      // Looker's real Platinum sprite (Spr_Pt_Looker). Showdown has no Looker, and
      // Bulbagarden answers 403 to browsers, so the file is fetched once and shipped with
      // the app instead of hotlinked — same approach as the gym badges.
      //
      // The filename carries the "-pt" (Platinum) suffix on purpose: an earlier build shipped
      // placeholder art at ./trainers/custom/looker.png, and the service worker serves
      // same-origin images stale-while-revalidate. Reusing that URL made returning players see
      // the old placeholder from cache. A distinct URL can never collide with that entry.
      spriteUrl: './trainers/custom/looker-pt.png',
      blurb: 'trainer.blurb.looker',
    },
    { name: 'Riley', spriteUrl: `${SHOWDOWN}/riley.png`, blurb: 'trainer.blurb.riley' },
  ],
  5: [
    { name: 'Bianca', spriteUrl: `${SHOWDOWN}/bianca.png`, blurb: 'trainer.blurb.bianca' },
    { name: 'Cheren', spriteUrl: `${SHOWDOWN}/cheren.png`, blurb: 'trainer.blurb.cheren' },
    { name: 'Hugh', spriteUrl: `${SHOWDOWN}/hugh.png`, blurb: 'trainer.blurb.hugh' },
  ],
  6: [
    { name: 'Shauna', spriteUrl: `${SHOWDOWN}/shauna.png`, blurb: 'trainer.blurb.shauna' },
    { name: 'Tierno', spriteUrl: `${SHOWDOWN}/tierno.png`, blurb: 'trainer.blurb.tierno' },
    { name: 'Trevor', spriteUrl: `${SHOWDOWN}/trevor.png`, blurb: 'trainer.blurb.trevor' },
  ],
  7: [
    { name: 'Hau', spriteUrl: `${SHOWDOWN}/hau.png`, blurb: 'trainer.blurb.hau' },
  ],
  8: [
    { name: 'Hop', spriteUrl: `${SHOWDOWN}/hop.png`, blurb: 'trainer.blurb.hop' },
    { name: 'Bede', spriteUrl: `${SHOWDOWN}/bede.png`, blurb: 'trainer.blurb.bede' },
    { name: 'Klara', spriteUrl: `${SHOWDOWN}/klara.png`, blurb: 'trainer.blurb.klara' },
    { name: 'Avery', spriteUrl: `${SHOWDOWN}/avery.png`, blurb: 'trainer.blurb.avery' },
  ],
  9: [
    // Cassiopeia is Penny's Team Star alias — one person, one entry. Paldea's villain boss
    // is Sada or Turo, so she is no longer doing both jobs.
    { name: 'Cassiopeia', spriteUrl: `${SHOWDOWN}/penny.png`, blurb: 'trainer.blurb.cassiopeia' },
    { name: 'Arven', spriteUrl: './trainers/custom/arven.png', blurb: 'trainer.blurb.arven' },
  ],
};

/**
 * The two protagonists of each region.
 *
 * You play one; the other turns up as an opponent. In Hoenn and Kalos that counterpart is
 * the rival (see COUNTERPART_RIVAL_GENERATIONS); everywhere else they join the Battle
 * Trainer wheel. Kanto follows the Japanese/Adventures names, so the pair is Red and Blue
 * and the rival Green is a third person.
 */
export const protagonistCharacterByGeneration: Record<
  number,
  { male: EncounterCharacter; female: EncounterCharacter }
> = {
  1: {
    male: { name: 'Red', spriteUrl: `${SHOWDOWN}/red.png`, blurb: 'trainer.blurb.red' },
    female: { name: 'Blue', spriteUrl: `${SHOWDOWN}/blue.png`, blurb: 'trainer.blurb.blueGirl' },
  },
  2: {
    male: { name: 'Ethan', spriteUrl: `${SHOWDOWN}/ethan.png`, blurb: 'trainer.blurb.ethan' },
    female: { name: 'Lyra', spriteUrl: `${SHOWDOWN}/lyra.png`, blurb: 'trainer.blurb.lyra' },
  },
  3: {
    male: { name: 'Brendan', spriteUrl: `${SHOWDOWN}/brendan.png`, blurb: 'trainer.blurb.brendan' },
    female: { name: 'May', spriteUrl: `${SHOWDOWN}/may.png`, blurb: 'trainer.blurb.may' },
  },
  4: {
    male: { name: 'Lucas', spriteUrl: `${SHOWDOWN}/lucas.png`, blurb: 'trainer.blurb.lucas' },
    female: { name: 'Dawn', spriteUrl: `${SHOWDOWN}/dawn.png`, blurb: 'trainer.blurb.dawn' },
  },
  5: {
    male: { name: 'Hilbert', spriteUrl: `${SHOWDOWN}/hilbert.png`, blurb: 'trainer.blurb.hilbert' },
    female: { name: 'Hilda', spriteUrl: `${SHOWDOWN}/hilda.png`, blurb: 'trainer.blurb.hilda' },
  },
  6: {
    male: { name: 'Calem', spriteUrl: `${SHOWDOWN}/calem.png`, blurb: 'trainer.blurb.calem' },
    female: { name: 'Serena', spriteUrl: `${SHOWDOWN}/serena.png`, blurb: 'trainer.blurb.serena' },
  },
  7: {
    male: { name: 'Elio', spriteUrl: `${SHOWDOWN}/elio.png`, blurb: 'trainer.blurb.elio' },
    female: { name: 'Selene', spriteUrl: `${SHOWDOWN}/selene.png`, blurb: 'trainer.blurb.selene' },
  },
  8: {
    male: { name: 'Victor', spriteUrl: `${SHOWDOWN}/victor.png`, blurb: 'trainer.blurb.victor' },
    female: { name: 'Gloria', spriteUrl: `${SHOWDOWN}/gloria.png`, blurb: 'trainer.blurb.gloria' },
  },
  9: {
    male: { name: 'Florian', spriteUrl: `${SHOWDOWN}/florian-s.png`, blurb: 'trainer.blurb.florian' },
    female: { name: 'Juliana', spriteUrl: `${SHOWDOWN}/juliana-s.png`, blurb: 'trainer.blurb.juliana' },
  },
};

/**
 * Reserve competitors that top a tournament field back up to its full size.
 *
 * A regional bracket seats sixteen *people*, but three regions hand one person two jobs:
 * Alola's Olivia is a kahuna and an Elite Four member, Galar brings Nessa, Bea, Raihan and
 * Marnie back as Elite Four members, and Paldea's Larry runs the Medali Gym while sitting
 * in the Elite Four. These are the next canonical opponents of each region, drafted in
 * order until the field is full. Rosters live in extraFieldTeamsByGeneration.
 *
 * Arven's sprite is the Scarlet/Violet official artwork, fetched once and shipped with the
 * app (Showdown has no Arven, and Bulbagarden 403s browsers) — same approach as Looker.
 */
export const extraFieldTrainerByGeneration: Record<number, EncounterCharacter[]> = {
  7: [
    {
      name: 'Plumeria',
      spriteUrl: `${SHOWDOWN}/plumeria.png`,
      blurb: 'trainer.blurb.plumeria',
    },
  ],
  8: [
    { name: 'Peony', spriteUrl: `${SHOWDOWN}/peony.png`, blurb: 'trainer.blurb.peony' },
    { name: 'Mustard', spriteUrl: `${SHOWDOWN}/mustard.png`, blurb: 'trainer.blurb.mustard' },
  ],
};

/**
 * Villain Team encounters (replaces the old "Team Rocket" encounter).
 * Some generations can randomize between version-exclusive teams.
 */
export const villainTeamByGeneration: Record<number, VillainTeamEncounter> = {
  1: {
    teamName: 'Team Rocket',
    leaders: [
      {
        name: 'Giovanni',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png',
        blurb: 'The boss of Team Rocket. Beware!',
      },
    ],
    blurb: 'A shady organization tries to steal your Pokémon!',
  },
  2: {
    teamName: 'Team Rocket',
    leaders: [
      {
        name: 'Proton',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/proton.png',
        blurb: 'A Team Rocket executive is causing trouble.',
      },
    ],
    blurb: 'Team Rocket is back again in Johto.',
  },
  3: {
    teamName: 'Team Magma / Team Aqua',
    leaders: [
      {
        name: 'Maxie',
        // Showdown has no plain "maxie.png"; the ORAS sprite is the -gen6 variant.
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/maxie-gen6.png',
        blurb: 'Team Magma wants to expand the land.',
      },
      {
        name: 'Archie',
        // Same as Maxie: only the -gen6 (ORAS) sprite exists on Showdown.
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/archie-gen6.png',
        blurb: 'Team Aqua wants to expand the sea.',
      },
    ],
    blurb: 'Two rival villain teams can appear, depending on the version.',
  },
  4: {
    teamName: 'Team Galactic',
    leaders: [
      {
        name: 'Cyrus',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/cyrus.png',
        blurb: "Team Galactic's cold and calculating leader.",
      },
    ],
    blurb: 'Team Galactic wants to reshape the world.',
  },
  5: {
    teamName: 'Team Plasma',
    leaders: [
      {
        name: 'Ghetsis',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/ghetsis.png',
        blurb: 'The true mastermind behind Team Plasma.',
      },
    ],
    blurb: 'Team Plasma is here to cause chaos.',
  },
  6: {
    teamName: 'Team Flare',
    leaders: [
      {
        name: 'Lysandre',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/lysandre.png',
        blurb: 'The stylish but dangerous Team Flare leader.',
      },
    ],
    blurb: 'Team Flare is plotting something huge.',
  },
  7: {
    teamName: 'Team Skull',
    leaders: [
      {
        name: 'Guzma',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/guzma.png',
        blurb: 'The boss of Team Skull.',
      },
    ],
    blurb: 'Team Skull grunts block your way and start trouble.',
  },
  8: {
    teamName: 'Macro Cosmos',
    leaders: [
      {
        name: 'Chairman Rose',
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/rose.png',
        blurb: 'The chairman behind Macro Cosmos.',
      },
    ],
    blurb: 'A corporate villain shows up at the worst time.',
  },
  9: {
    // Cassiopeia is only Team Star's figurehead, and she is a Battle Trainer now. Paldea's
    // real boss is the professor behind the Zero Lab — which one depends on the version, so
    // the game spins for it the same way Hoenn spins between Magma and Aqua.
    teamName: 'Zero Lab',
    leaders: [
      {
        name: 'Professor Sada',
        spriteUrl: `${SHOWDOWN}/sada.png`,
        blurb: 'The professor of the past, guarded by Koraidon.',
      },
      {
        name: 'Professor Turo',
        spriteUrl: `${SHOWDOWN}/turo.png`,
        blurb: 'The professor of the future, guarded by Miraidon.',
      },
    ],
    blurb: 'Someone is waiting at the bottom of Area Zero.',
  },
};

/**
 * "Snorlax" encounter reskin: a generation-themed roadblock/tool/comic Pokémon.
 */
export const roadblockByGeneration: Record<number, RoadblockEncounter> = {
  1: {
    pokemonId: 143,
    pokemonNameKey: 'pokemon.snorlax',
    blurb: 'A sleeping roadblock Pokémon.',
  },
  2: {
    pokemonId: 185,
    pokemonNameKey: 'pokemon.sudowoodo',
    blurb: 'The odd tree that blocks your way.',
  },
  3: {
    pokemonId: 352,
    pokemonNameKey: 'pokemon.kecleon',
    blurb: 'It was invisible… until you got close.',
  },
  4: {
    pokemonId: 54,
    pokemonNameKey: 'pokemon.psyduck',
    blurb: 'A pack of Psyduck blocks the road with headaches.',
  },
  5: {
    pokemonId: 558,
    pokemonNameKey: 'pokemon.crustle',
    blurb: 'Crustle are in the way. Watch your step.',
  },
  6: {
    // Gen 6: use a "tool" Pokémon from Kalos (Gogoat Shuttle).
    pokemonId: 673,
    pokemonNameKey: 'pokemon.gogoat',
    blurb: 'A Gogoat shuttle is blocking the street for a moment.',
  },
  7: {
    // Gen 7: Poké Ride partner
    pokemonId: 508,
    pokemonNameKey: 'pokemon.stoutland',
    blurb: 'Stoutland stops to sniff around and blocks the path.',
  },
  8: {
    pokemonId: 831,
    pokemonNameKey: 'pokemon.wooloo',
    blurb: 'A runaway Wooloo is causing trouble on the road.',
  },
  9: {
    pokemonId: 915,
    pokemonNameKey: 'pokemon.lechonk',
    blurb: 'A herd of Lechonk is blocking the road in Paldea.',
  },
};
