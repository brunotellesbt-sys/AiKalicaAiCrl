import { Injectable } from '@angular/core';

import { ItemItem } from '../../interfaces/item-item';
import { TrainerService } from '../trainer-service/trainer.service';

/**
 * Potion re-spins, shared by every battle.
 *
 * The gym, Elite Four and Champion roulettes each grew their own copy of this; rival and
 * villain boss battles had none, so potions silently did nothing there. One service keeps
 * all five consistent — every lost battle gets the same chance to spin again.
 */
@Injectable({ providedIn: 'root' })
export class BattleRetryService {
  /** Re-spins granted, strongest potion first so the cheapest one is spent last. */
  private readonly retriesByPotion: ReadonlyArray<readonly [string, number]> = [
    ['potion', 1],
    ['super-potion', 2],
    ['hyper-potion', 3],
  ];

  constructor(private trainerService: TrainerService) {}

  /** The potion that would be spent on a loss, if the trainer has one. */
  findPotion(items: ItemItem[] | null | undefined): ItemItem | undefined {
    return (items ?? []).find((item) => this.retriesFor(item) > 0);
  }

  /**
   * Spends the potion.
   *
   * @param items the caller's local copy of the bag, kept in sync with the trainer's.
   * @returns how many extra spins it buys.
   */
  consume(potion: ItemItem, items: ItemItem[]): number {
    const index = items.indexOf(potion);
    if (index !== -1) items.splice(index, 1);

    this.trainerService.removeItem(potion);
    return this.retriesFor(potion);
  }

  private retriesFor(item: ItemItem | undefined): number {
    const match = this.retriesByPotion.find(([name]) => name === item?.name);
    return match ? match[1] : 0;
  }
}
