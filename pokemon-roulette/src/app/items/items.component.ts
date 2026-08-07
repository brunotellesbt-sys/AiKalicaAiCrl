import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { Observable, Subscription } from 'rxjs';
import { ItemItem } from '../interfaces/item-item';
import { CommonModule } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TrainerService } from '../services/trainer-service/trainer.service';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'app-items',
  imports: [
    ImgFallbackDirective,CommonModule,
    NgbTooltipModule, TranslatePipe],
  templateUrl: './items.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './items.component.css'
})
export class ItemsComponent implements OnInit, OnDestroy {

  constructor(
    private darkModeService: DarkModeService,
    private trainerService: TrainerService,
    private translateService: TranslateService
  ) {
    this.darkMode = this.darkModeService.darkMode$;
  }

  trainerItems!: ItemItem[];
  @Output() rareCandyInterrupt = new EventEmitter<ItemItem>();

  darkMode!: Observable<boolean>;
  private itemsSubscription!: Subscription;

  ngOnInit(): void {
    this.itemsSubscription = this.trainerService.getItemsObservable().subscribe(items => {
      this.trainerItems = items;
    })
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
  }

  useItem(item: ItemItem | undefined) {
    if(item) {
      if (item.name === 'rare-candy') {
        this.rareCandyInterrupt.emit(item);
      }
    }
  }

  getItemSprite(index: number): string {
    if (this.trainerItems[index]) {
      return this.trainerItems[index].sprite;
    }
    return './place-holder-pixel.png';
  }

  getItemText(index: number): string {
    const item = this.trainerItems?.[index];
    if (!item) return 'Empty';

    const key = item.text;
    const value = this.translateService.instant(key);

    // ngx-translate can briefly return the key itself (before the JSON finishes loading),
    // and we never want to show raw keys like "items.hyper-potion.name".
    if (this.isRawKey(value, key)) {
      return this.titleCaseFromToken(item.name || key);
    }

    return value;
  }

  private isRawKey(value: string, key: string): boolean {
    const v = (value || '').toString().trim();
    const k = (key || '').toString().trim();
    return !v || v === k || v.startsWith('items.') || v.includes('.name') || v.includes('.description');
  }

  private titleCaseFromToken(token: string): string {
    return (token || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
