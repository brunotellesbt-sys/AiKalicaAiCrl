import { Badge } from "../../interfaces/badge";

// NOTE:
// Badges are hosted locally to avoid hotlink/CORS failures and intermittent third-party outages.
// The CI/build pipeline downloads these images into src/assets/badges/ before compiling.
const BADGE_ASSETS = 'assets/badges/';

export const badgesByGeneration: Record<number, (Badge | Badge[])[]> = {
  1: [
    { name: 'badges.boulder', sprite: `${BADGE_ASSETS}gen1/Boulder_Badge.png` },
    { name: 'badges.cascade', sprite: `${BADGE_ASSETS}gen1/Cascade_Badge.png` },
    { name: 'badges.thunder', sprite: `${BADGE_ASSETS}gen1/Thunder_Badge.png` },
    { name: 'badges.rainbow', sprite: `${BADGE_ASSETS}gen1/Rainbow_Badge.png` },
    { name: 'badges.soul', sprite: `${BADGE_ASSETS}gen1/Soul_Badge.png` },
    { name: 'badges.marsh', sprite: `${BADGE_ASSETS}gen1/Marsh_Badge.png` },
    { name: 'badges.volcano', sprite: `${BADGE_ASSETS}gen1/Volcano_Badge.png` },
    { name: 'badges.earth', sprite: `${BADGE_ASSETS}gen1/Earth_Badge.png` },
  ],
  2: [
    { name: 'badges.zephyr', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Zephyr_Badge.png` },
    { name: 'badges.hive', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Hive_Badge.png` },
    { name: 'badges.plain', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Plain_Badge.png` },
    { name: 'badges.fog', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Fog_Badge.png` },
    { name: 'badges.storm', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Storm_Badge.png` },
    { name: 'badges.mineral', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Mineral_Badge.png` },
    { name: 'badges.glacier', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Glacier_Badge.png` },
    { name: 'badges.rising', sprite: `${BADGE_ASSETS}gen2/Stadium_2_Rising_Badge.png` },
  ],
  3: [
    { name: 'badges.stone', sprite: `${BADGE_ASSETS}gen3/Stone_Badge.png` },
    { name: 'badges.knuckle', sprite: `${BADGE_ASSETS}gen3/Knuckle_Badge.png` },
    { name: 'badges.dynamo', sprite: `${BADGE_ASSETS}gen3/Dynamo_Badge.png` },
    { name: 'badges.heat', sprite: `${BADGE_ASSETS}gen3/Heat_Badge.png` },
    { name: 'badges.balance', sprite: `${BADGE_ASSETS}gen3/Balance_Badge.png` },
    { name: 'badges.feather', sprite: `${BADGE_ASSETS}gen3/Feather_Badge.png` },
    { name: 'badges.mind', sprite: `${BADGE_ASSETS}gen3/Mind_Badge.png` },
    { name: 'badges.rain', sprite: `${BADGE_ASSETS}gen3/Rain_Badge.png` },
  ],
  4: [
    { name: 'badges.coal', sprite: `${BADGE_ASSETS}gen4/Coal_Badge.png` },
    { name: 'badges.forest', sprite: `${BADGE_ASSETS}gen4/Forest_Badge.png` },
    { name: 'badges.cobble', sprite: `${BADGE_ASSETS}gen4/Cobble_Badge.png` },
    { name: 'badges.fen', sprite: `${BADGE_ASSETS}gen4/Fen_Badge.png` },
    { name: 'badges.relic', sprite: `${BADGE_ASSETS}gen4/Relic_Badge.png` },
    { name: 'badges.mine', sprite: `${BADGE_ASSETS}gen4/Mine_Badge.png` },
    { name: 'badges.icicle', sprite: `${BADGE_ASSETS}gen4/Icicle_Badge.png` },
    { name: 'badges.beacon', sprite: `${BADGE_ASSETS}gen4/Beacon_Badge.png` },
  ],
  5: [
    { name: 'badges.trio', sprite: `${BADGE_ASSETS}gen5/Trio_Badge.png` },
    { name: 'badges.basic', sprite: `${BADGE_ASSETS}gen5/Basic_Badge.png` },
    { name: 'badges.insect', sprite: `${BADGE_ASSETS}gen5/Insect_Badge.png` },
    { name: 'badges.bolt', sprite: `${BADGE_ASSETS}gen5/Bolt_Badge.png` },
    { name: 'badges.quake', sprite: `${BADGE_ASSETS}gen5/Quake_Badge.png` },
    { name: 'badges.jet', sprite: `${BADGE_ASSETS}gen5/Jet_Badge.png` },
    { name: 'badges.freeze', sprite: `${BADGE_ASSETS}gen5/Freeze_Badge.png` },
    { name: 'badges.legend', sprite: `${BADGE_ASSETS}gen5/Legend_Badge.png` },
  ],
  6: [
    { name: 'badges.bug', sprite: `${BADGE_ASSETS}gen6/Bug_Badge.png` },
    { name: 'badges.cliff', sprite: `${BADGE_ASSETS}gen6/Cliff_Badge.png` },
    { name: 'badges.rumble', sprite: `${BADGE_ASSETS}gen6/Rumble_Badge.png` },
    { name: 'badges.plant', sprite: `${BADGE_ASSETS}gen6/Plant_Badge.png` },
    { name: 'badges.voltage', sprite: `${BADGE_ASSETS}gen6/Voltage_Badge.png` },
    { name: 'badges.fairy', sprite: `${BADGE_ASSETS}gen6/Fairy_Badge.png` },
    { name: 'badges.psychic', sprite: `${BADGE_ASSETS}gen6/Psychic_Badge.png` },
    { name: 'badges.iceberg', sprite: `${BADGE_ASSETS}gen6/Iceberg_Badge.png` },
  ],
  7: [
    { name: 'badges.normalium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Normalium_Z_Sprite.png` },
    { name: 'badges.fightinium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Fightinium_Z_Sprite.png` },
    [
      { name: 'badges.waterium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Waterium_Z_Sprite.png` },
      { name: 'badges.firium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Firium_Z_Sprite.png` },
      { name: 'badges.grassium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Grassium_Z_Sprite.png` }
    ],
    { name: 'badges.rockium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Rockium_Z_Sprite.png` },
    [
      { name: 'badges.electrium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Electrium_Z_Sprite.png` },
      { name: 'badges.ghostium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Ghostium_Z_Sprite.png` },
    ],
    { name: 'badges.darkinium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Darkinium_Z_Sprite.png` },
    { name: 'badges.fairium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Fairium_Z_Sprite.png` },
    { name: 'badges.groundium_z', sprite: `${BADGE_ASSETS}gen7/Dream_Groundium_Z_Sprite.png` },
  ],
  8: [
    { name: 'badges.grass', sprite: `${BADGE_ASSETS}gen8/Grass_Badge.png` },
    { name: 'badges.water', sprite: `${BADGE_ASSETS}gen8/Water_Badge.png` },
    { name: 'badges.fire', sprite: `${BADGE_ASSETS}gen8/Fire_Badge.png` },
    [
      { name: 'badges.fighting', sprite: `${BADGE_ASSETS}gen8/Fighting_Badge.png` },
      { name: 'badges.ghost', sprite: `${BADGE_ASSETS}gen8/Ghost_Badge.png` },
    ],
    { name: 'badges.fairy_galar', sprite: `${BADGE_ASSETS}gen8/GalarFairy_Badge.png` },
    [
      { name: 'badges.rock', sprite: `${BADGE_ASSETS}gen8/Rock_Badge.png` },
      { name: 'badges.ice', sprite: `${BADGE_ASSETS}gen8/Ice_Badge.png` },
    ],
    { name: 'badges.dark', sprite: `${BADGE_ASSETS}gen8/Dark_Badge.png` },
    { name: 'badges.dragon', sprite: `${BADGE_ASSETS}gen8/Dragon_Badge.png` },
  ],

  9: [
    // Paldea Gym Badges (Victory Road)
    { name: 'Bug Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Bug.png` },
    { name: 'Grass Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Grass.png` },
    { name: 'Electric Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Electric.png` },
    { name: 'Water Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Water.png` },
    { name: 'Normal Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Normal.png` },
    { name: 'Ghost Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Ghost.png` },
    { name: 'Psychic Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Psychic.png` },
    { name: 'Ice Badge', sprite: `${BADGE_ASSETS}gen9/SVbadge_VictoryRoad_Ice.png` },
  ]
}
