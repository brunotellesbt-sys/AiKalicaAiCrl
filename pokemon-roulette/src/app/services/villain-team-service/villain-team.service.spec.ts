import { TestBed } from '@angular/core/testing';

import { VillainTeamService } from './villain-team.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

function mon(name: string): PokemonItem {
  return {
    text: name,
    pokemonId: 1,
    fillStyle: 'green',
    sprite: null,
    shiny: false,
    power: 1,
    weight: 1,
  };
}

/**
 * The point of holding stolen Pokémon per team is that beating one organisation must not
 * hand back what a different one took. These cover that boundary, and the release at the
 * region's boss that stops anything being lost for good.
 */
describe('VillainTeamService', () => {
  let service: VillainTeamService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VillainTeamService);
    service.reset();
  });

  it('gives Hoenn two teams and everywhere else one', () => {
    expect(service.teamsFor(3).map((t) => t.id)).toEqual(['magma', 'aqua']);
    expect(service.needsTeamRoll(3)).toBe(true);

    expect(service.teamsFor(1).map((t) => t.id)).toEqual(['rocket-kanto']);
    expect(service.needsTeamRoll(1)).toBe(false);
  });

  it('files Kanto and Johto Rocket separately despite the shared name', () => {
    const kanto = service.teamsFor(1)[0];
    const johto = service.teamsFor(2)[0];

    expect(kanto.name).toBe(johto.name);
    expect(kanto.id).not.toBe(johto.id);
    // Same organisation, so the colour stays put — only the era differs.
    expect(kanto.colour).toBe(johto.colour);
  });

  it('returns only what the beaten team took', () => {
    service.steal('magma', mon('Numel'));
    service.steal('aqua', mon('Carvanha'));

    const fromMagma = service.recoverFrom('magma');

    expect(fromMagma.map((p) => p.text)).toEqual(['Numel']);
    // Aqua still has theirs — beating Magma is not a general amnesty.
    expect(service.heldBy('aqua').map((p) => p.text)).toEqual(['Carvanha']);
  });

  it('empties a team once beaten, so a later robbery starts fresh', () => {
    service.steal('magma', mon('Numel'));
    service.recoverFrom('magma');

    expect(service.heldBy('magma')).toEqual([]);

    service.steal('magma', mon('Slugma'));
    expect(service.recoverFrom('magma').map((p) => p.text)).toEqual(['Slugma']);
  });

  it('releases everything the region holds when its boss falls', () => {
    service.steal('magma', mon('Numel'));
    service.steal('aqua', mon('Carvanha'));
    service.steal('rocket-kanto', mon('Rattata'));

    const recovered = service.recoverForGeneration(3).map((p) => p.text);

    expect(recovered.sort()).toEqual(['Carvanha', 'Numel']);
    // A different region's losses are not part of Hoenn's amnesty.
    expect(service.heldBy('rocket-kanto').map((p) => p.text)).toEqual(['Rattata']);
    expect(service.totalHeld).toBe(1);
  });

  it('shows a grunt on the road and the boss at the boss fight', () => {
    const magma = service.teamsFor(3)[0];

    service.beginEncounter(magma, 'roadside');
    expect(service.currentTeam!.id).toBe('magma');
    expect(service.currentGrunt).not.toBeNull();

    service.beginEncounter(magma, 'boss');
    // No grunt standing next to the boss — that fight is the region's climax.
    expect(service.currentGrunt).toBeNull();
  });

  it('only ever rolls a team that belongs to the region', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(service.rollTeam(3)!.id);

    expect([...ids].sort()).toEqual(['aqua', 'magma']);
    expect(service.rollTeam(99)).toBeNull();
  });

  it('starts a new run with nobody holding anything', () => {
    service.steal('magma', mon('Numel'));
    service.reset();

    expect(service.totalHeld).toBe(0);
    expect(service.currentTeam).toBeNull();
  });
});
