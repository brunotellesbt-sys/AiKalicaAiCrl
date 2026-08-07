import { Injectable } from '@angular/core';
import { GenerationItem } from '../../interfaces/generation-item';
import { Observable } from 'rxjs';
import { badgesByGeneration } from './badges-data';
import { Badge } from '../../interfaces/badge';

@Injectable({
  providedIn: 'root'
})
export class BadgesService {

  constructor() { }

  badgesByGeneration = badgesByGeneration;

  getBadge(generation: GenerationItem, fromRound: number, fromLeader: number): Observable<Badge> {

    const byGen = this.badgesByGeneration[generation.id] ?? [];
    const entry = byGen[fromRound];

    let resolved: Badge | undefined;

    if (Array.isArray(entry)) {
      resolved = entry[fromLeader] ?? entry[0];
    } else {
      resolved = entry as Badge | undefined;
    }

    // Never return undefined—missing/invalid mappings should not break the UI.
    if (!resolved) {
      resolved = { name: 'badges.unknown', sprite: './place-holder-pixel.png' };
    }

    return new Observable(observer => {
      observer.next(resolved);
      observer.complete();
    });
  }
}
