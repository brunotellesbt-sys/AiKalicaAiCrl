import { Component, EventEmitter, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { WheelComponent } from '../../../../wheel/wheel.component';
import { WheelItem } from '../../../../interfaces/wheel-item';

@Component({
  selector: 'app-boss-legendary-outcome-roulette',
  imports: [WheelComponent],
  templateUrl: './boss-legendary-outcome-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './boss-legendary-outcome-roulette.component.css',
})
export class BossLegendaryOutcomeRouletteComponent implements OnInit {
  @Output() defeatEvent = new EventEmitter<void>();
  @Output() captureEvent = new EventEmitter<void>();

  outcomes: WheelItem[] = [];

  ngOnInit(): void {
    // Fixed 50/50 outcome as requested.
    this.outcomes = [
      { text: 'Defeat', fillStyle: '#0d6efd', weight: 1 },
      { text: 'Capture', fillStyle: 'green', weight: 1 },
    ];
  }

  onItemSelected(index: number): void {
    if (index === 0) {
      this.defeatEvent.emit();
      return;
    }
    this.captureEvent.emit();
  }
}
