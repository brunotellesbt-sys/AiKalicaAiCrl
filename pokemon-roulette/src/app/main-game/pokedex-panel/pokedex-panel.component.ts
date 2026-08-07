import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { PokedexUiService } from '../../services/pokedex-ui.service';

@Component({
  selector: 'app-pokedex-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokedex-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pokedex-panel.component.css'
})
export class PokedexPanelComponent {
  constructor(private pokedexUi: PokedexUiService) {}

  openPokedex(): void {
    this.pokedexUi.open();
  }
}
