import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import { MegaEvolutionRouletteComponent } from './mega-evolution-roulette.component';
import { MegaEvolutionService, MegaForm } from '../../../../services/mega-evolution-service/mega-evolution.service';
import { TrainerService } from '../../../../services/trainer-service/trainer.service';
import { CryService } from '../../../../services/cry-service/cry.service';
import { SettingsService } from '../../../../services/settings-service/settings.service';
import { PokemonItem } from '../../../../interfaces/pokemon-item';

/**
 * A wheel is a question. When the team has exactly one Pokémon that can Mega Evolve, the
 * Pokémon wheel is not asking anything — it has one slice, it always lands on it, and the
 * player has to spin it to be told what they already knew. These pin the two shapes the
 * screen may take in that case: transform outright when there is a single Mega form, or go
 * straight to the form wheel when there is a real choice left to make.
 *
 * The template is overridden away: it renders a canvas wheel and a modal, neither of which
 * these assertions touch and neither of which stands up in jsdom.
 */
describe('MegaEvolutionRouletteComponent', () => {
  let fixture: ComponentFixture<MegaEvolutionRouletteComponent>;
  let component: MegaEvolutionRouletteComponent;

  let team: PokemonItem[];
  let formsByPokemonId: Map<number, MegaForm[]>;
  let evolved: Array<{ pokemon: PokemonItem; form: MegaForm }>;

  function pokemon(id: number, text: string): PokemonItem {
    return {
      text,
      fillStyle: 'crimson',
      weight: 1,
      pokemonId: id,
      sprite: { front_default: '', front_shiny: '' },
      shiny: false,
      power: 3,
    };
  }

  function megaForm(id: number, displayName: string): MegaForm {
    return { pokemonId: id, apiName: displayName.toLowerCase().replace(/\s+/g, '-'), displayName };
  }

  beforeEach(async () => {
    team = [];
    formsByPokemonId = new Map();
    evolved = [];

    await TestBed.configureTestingModule({
      imports: [MegaEvolutionRouletteComponent],
      providers: [
        { provide: TrainerService, useValue: { getTeam: () => team } },
        {
          provide: MegaEvolutionService,
          useValue: {
            megaCapableSpeciesIds: () => of(new Set<number>(formsByPokemonId.keys())),
            canMegaEvolveLocally: (p: PokemonItem) => formsByPokemonId.has(p.pokemonId),
            getMegaFormsForPokemon: (p: PokemonItem) => of(formsByPokemonId.get(p.pokemonId) ?? []),
            megaEvolveForBattle: (p: PokemonItem, form: MegaForm) => {
              evolved.push({ pokemon: p, form });
              return of(void 0);
            },
          },
        },
        { provide: CryService, useValue: { resolvePlayableCry: () => Promise.resolve(null), playResolvedCry: () => {} } },
        { provide: SettingsService, useValue: {} },
        { provide: NgbModal, useValue: { open: () => ({ result: new Promise(() => {}), close: () => {} }) } },
      ],
    })
      .overrideComponent(MegaEvolutionRouletteComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MegaEvolutionRouletteComponent);
    component = fixture.componentInstance;
  });

  /** Runs ngOnInit and lets the deferred transformation path settle. */
  async function start(): Promise<void> {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('skips the wheel entirely for a lone candidate with one Mega form', async () => {
    team = [pokemon(6, 'charizard'), pokemon(25, 'pikachu')];
    formsByPokemonId.set(6, [megaForm(10034, 'Mega Charizard Y')]);

    await start();

    expect(component.wheelItems).toEqual([]);
    expect(evolved.length).toBe(1);
    expect(evolved[0].pokemon.text).toBe('charizard');
    expect(evolved[0].form.displayName).toBe('Mega Charizard Y');
  });

  it('shows only the form wheel for a lone candidate with two Mega forms', async () => {
    team = [pokemon(6, 'charizard'), pokemon(25, 'pikachu')];
    formsByPokemonId.set(6, [megaForm(10034, 'Mega Charizard X'), megaForm(10035, 'Mega Charizard Y')]);

    await start();

    // Never the Pokémon wheel: the only question left is which form.
    expect(component.mode).toBe('select-mega-form');
    expect(component.wheelItems.map((i) => i.text)).toEqual(['Mega Charizard X', 'Mega Charizard Y']);
    expect(evolved.length).toBe(0);
  });

  it('still asks which Pokémon when more than one of them can Mega Evolve', async () => {
    team = [pokemon(6, 'charizard'), pokemon(9, 'blastoise')];
    formsByPokemonId.set(6, [megaForm(10034, 'Mega Charizard Y')]);
    formsByPokemonId.set(9, [megaForm(10036, 'Mega Blastoise')]);

    await start();

    expect(component.mode).toBe('select-pokemon');
    expect(component.wheelItems.map((i) => i.text)).toEqual(['charizard', 'blastoise']);
    expect(evolved.length).toBe(0);
  });

  it('leaves the state when nobody on the team can Mega Evolve', async () => {
    team = [pokemon(25, 'pikachu')];

    let finished = false;
    component.megaEvolutionFinished.subscribe(() => (finished = true));

    await start();

    expect(finished).toBe(true);
    expect(component.wheelItems).toEqual([]);
  });
});
