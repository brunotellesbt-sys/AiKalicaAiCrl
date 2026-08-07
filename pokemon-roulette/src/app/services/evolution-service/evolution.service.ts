import { Injectable } from '@angular/core';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { evolutionChain } from './evolution-chain';
import { PokemonService } from '../pokemon-service/pokemon.service';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {

  constructor(private pokemonService: PokemonService) {
    this.nationalDexPokemon = this.pokemonService.getAllPokemon();
  }

  evolutionChain = evolutionChain;
  nationalDexPokemon: PokemonItem[];

  canEvolve(pokemon: PokemonItem): boolean {
    const chain = this.evolutionChain[pokemon.pokemonId];
    // IMPORTANT:
    // Some base forms are intentionally present with an empty list (e.g. Johto Qwilfish),
    // because only a regional form evolves. An empty array must NOT count as evolvable.
    return Array.isArray(chain) && chain.length > 0;
  }

  getEvolutions(pokemon: PokemonItem): PokemonItem[] {
    const chain = this.evolutionChain[pokemon.pokemonId];
    if (!Array.isArray(chain) || chain.length === 0) return [];

    let evolutions: PokemonItem[] = [];
    chain.forEach(evolutionId => {
      const evolution = this.pokemonService.getPokemonById(evolutionId);

      if (evolution) {
        evolutions.push(evolution);
      }
    })
    return evolutions;
  }
}
