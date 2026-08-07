import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { EnemyPokemon, TypeAdvantage } from '../../services/enemy-team-service/enemy-team.service';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

/**
 * Opponent squad + matchup readout, shared by every battle in Type Advantage mode.
 *
 * Always rendered inside a modal that already interrupts the flow, so showing it costs no
 * extra tap. Icons stay at 40px (34px on phones) so six slots fit two rows at worst.
 */
@Component({
  selector: 'app-enemy-team-panel',
  standalone: true,
  imports: [NgClass, TranslatePipe, ImgFallbackDirective],
  templateUrl: './enemy-team-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './enemy-team-panel.component.css',
})
export class EnemyTeamPanelComponent {
  @Input() enemyTeam: EnemyPokemon[] = [];
  @Input() typeAdvantage: TypeAdvantage | null = null;
  @Input() playerTeamSize = 0;
}
