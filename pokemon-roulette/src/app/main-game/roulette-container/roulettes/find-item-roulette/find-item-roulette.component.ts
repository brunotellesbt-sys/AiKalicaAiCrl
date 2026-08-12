import { Component, EventEmitter, Output, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { ItemsService } from '../../../../services/items-service/items.service';
import { ItemSpriteService } from '../../../../services/item-sprite-service/item-sprite.service';
import { ItemItem } from '../../../../interfaces/item-item';
import { ImgFallbackDirective } from '../../../../shared/img-fallback.directive';
import { AudioService } from '../../../../services/audio-service/audio.service';
import { WheelItem } from '../../../../interfaces/wheel-item';

@Component({
  selector: 'app-find-item-roulette',
  imports: [
    ImgFallbackDirective,
    WheelComponent,
    TranslatePipe
],
  templateUrl: './find-item-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './find-item-roulette.component.css'
})
export class FindItemRouletteComponent {

  constructor(private modalService: NgbModal,
    private itemService: ItemsService,
    private itemSpriteService: ItemSpriteService,
    private audioService: AudioService) {
    this.items = itemService.getAllItems();
    // The egg rides along as one extra slice rather than being an item: it is not something
    // you carry, it hatches into a Pokémon, so it routes to the egg encounter instead of the
    // bag. Appended so every real item keeps the index it already had.
    this.slices = [
      ...this.items,
      { text: 'game.main.roulette.findItem.mysteriousEgg', fillStyle: 'deeppink', weight: 1 },
    ];
    this.itemFoundAudio = this.audioService.createAudio('./ItemFound.mp3');
  }

  @ViewChild('itemExplainerModal', { static: true }) itemExplainerModal!: TemplateRef<any>;
  items: ItemItem[] = [];
  /** The items plus the egg; what the wheel actually draws. */
  slices: WheelItem[] = [];
  selectedItem: ItemItem | null = null;
  @Output() itemSelectedEvent = new EventEmitter<ItemItem>();
  @Output() mysteriousEggEvent = new EventEmitter<void>();
  itemFoundAudio!: HTMLAudioElement;

  onItemSelected(index: number): void {
    // Anything past the item list is the egg slice.
    if (index >= this.items.length) {
      this.mysteriousEggEvent.emit();
      return;
    }

    this.selectedItem = this.items[index];

    this.itemSpriteService.getItemSprite(this.selectedItem.name).pipe(take(1)).subscribe(response => {
      if (this.selectedItem) {
        this.selectedItem.sprite = response.sprite;
      }
    });

    this.audioService.playAudio(this.itemFoundAudio, 0.25);

    const modalRef = this.modalService.open(this.itemExplainerModal, {
      centered: true,
      size: 'md',
      keyboard: false
    });

    modalRef.result.then(() => {
      if (this.selectedItem) {
        this.itemSelectedEvent.emit(this.selectedItem);
      }
    }, () => {
      if (this.selectedItem) {
        this.itemSelectedEvent.emit(this.selectedItem);
      }
    });
  }

  closeItemExplainerModal(): void {
    this.modalService.dismissAll();
  }
}
