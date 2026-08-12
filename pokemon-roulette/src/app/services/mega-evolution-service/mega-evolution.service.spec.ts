import { TestBed } from '@angular/core/testing';

import { MegaEvolutionService } from './mega-evolution.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

function mon(text: string, pokemonId: number, basePokemonId?: number): PokemonItem {
  return {
    text,
    pokemonId,
    basePokemonId,
    fillStyle: 'goldenrod',
    sprite: null,
    shiny: false,
    power: 3,
    weight: 1,
  };
}

/**
 * Mega Evolution is a property of the FORM, not the species.
 *
 * `basePokemonId` exists so species-level questions — evolution chains, cries — still
 * resolve for a regional variant, and the Mega check used to read it too. That collapsed
 * Alolan Raichu onto Raichu and let it Mega Evolve into a form only the Kantonian one has,
 * and the same went for every regional variant of a Mega-capable species.
 */
describe('MegaEvolutionService', () => {
  let service: MegaEvolutionService;

  /** Stands in for the generated table: Kantonian Raichu and Venusaur can, nothing else. */
  const capable = new Set<number>([26, 3]);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MegaEvolutionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('lets a base form Mega Evolve when its species can', () => {
    expect(service.canMegaEvolveLocally(mon('Raichu', 26), capable)).toBe(true);
    expect(service.canMegaEvolveLocally(mon('Venusaur', 3), capable)).toBe(true);
  });

  it('does not let a regional variant inherit its base species Mega', () => {
    // Alolan Raichu: its own id is the form's, and it carries Raichu as the base species.
    expect(service.canMegaEvolveLocally(mon('Raichu (Alola)', 10100, 26), capable)).toBe(false);
  });

  it('keeps every other regional variant of a Mega-capable species out too', () => {
    const variants = [
      mon('Raichu (Alola)', 10100, 26),
      mon('Growlithe (Hisui)', 10229, 58),
      mon('Meowth (Galar)', 10161, 52),
    ];

    for (const variant of variants) {
      expect(service.canMegaEvolveLocally(variant, capable)).toBe(false);
    }
  });

  it('says no for a species with no Mega at all', () => {
    expect(service.canMegaEvolveLocally(mon('Bidoof', 399), capable)).toBe(false);
  });
});
