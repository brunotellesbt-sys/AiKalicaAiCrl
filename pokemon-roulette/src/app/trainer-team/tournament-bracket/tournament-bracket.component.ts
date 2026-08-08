import { Component, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import {
  Competitor,
  TournamentGroup,
  TournamentMatch,
  TournamentService,
} from '../../services/tournament-service/tournament.service';

/**
 * The tournament table, shown inside the PC while a tournament is running.
 *
 * The World Tournament shows group standings until the groups are done and the bracket
 * after that; the regional tournament only ever has a bracket.
 */
@Component({
  selector: 'app-tournament-bracket',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './tournament-bracket.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tournament-bracket.component.css',
})
export class TournamentBracketComponent {
  constructor(private tournamentService: TournamentService) {}

  get isActive(): boolean {
    return this.tournamentService.kind !== null;
  }

  get kindLabel(): string {
    return `game.main.tournament.kind.${this.tournamentService.kind ?? 'regional'}`;
  }

  get stageLabel(): string {
    return `game.main.tournament.phase.${this.tournamentService.stage}`;
  }

  get groups(): TournamentGroup[] {
    return this.tournamentService.groupTable;
  }

  get rounds(): TournamentMatch[][] {
    return this.tournamentService.bracket;
  }

  get showGroups(): boolean {
    return this.groups.length > 0;
  }

  /**
   * The matches worth showing.
   *
   * A preliminary round is mostly byes — entrants walking through untouched — and listing
   * them as "Agatha vs —" rows buried the one fight that actually happens.
   */
  contested(round: TournamentMatch[]): TournamentMatch[] {
    return round.filter((m) => m.a && m.b);
  }

  /** Rounds with byes are the play-in; the rest are named for how many matches they hold. */
  roundLabel(round: TournamentMatch[]): string {
    if (round.some((m) => !m.b)) return 'game.main.tournament.round.playIn';
    return `game.main.tournament.round.${round.length}`;
  }

  /** Hides a round that turned out to be nothing but byes. */
  hasMatches(round: TournamentMatch[]): boolean {
    return this.contested(round).length > 0;
  }

  /**
   * Rounds that actually hold a fight, filtered once for the template.
   *
   * A 16-entrant regional field is seeded into a 32-slot bracket, so the opening round is
   * fifteen byes and one real match. Rendering it produced a whole column of "Agatha vs —"
   * before the bracket proper, which is what made the screen look broken on a phone.
   */
  get playedRounds(): TournamentMatch[][] {
    return this.rounds.filter((round) => this.hasMatches(round));
  }

  /**
   * A side's label, always a translation key so the template can pipe it unconditionally.
   *
   * Competitor names are sometimes keys and sometimes literals; `translate` returns its
   * input untouched when there is no matching key, so routing both through it keeps the
   * template free of the nested ternary this used to carry.
   */
  sideName(competitor: Competitor | null | undefined): string {
    return competitor?.name ?? '—';
  }

  isLoser(match: TournamentMatch, competitor: Competitor | null | undefined): boolean {
    return !!competitor && !!match.winner && match.winner.id !== competitor.id;
  }

  hasPlayer(group: TournamentGroup): boolean {
    return group.standings.some((s) => s.competitor.isPlayer);
  }

  /** Standings are pre-sorted, so the qualifying places are simply the top rows. */
  qualifies(index: number): boolean {
    return index < this.qualifiersPerGroup;
  }

  get qualifiersPerGroup(): number {
    return this.tournamentService.qualifiersPerGroup;
  }

  displayName(competitor: Competitor | null | undefined): string {
    return competitor?.name ?? '';
  }

  isTranslationKey(name: string): boolean {
    return name.includes('.');
  }

  isPlayer(competitor: Competitor | null | undefined): boolean {
    return !!competitor?.isPlayer;
  }

  isWinner(match: TournamentMatch, competitor: Competitor | null | undefined): boolean {
    return !!competitor && !!match.winner && match.winner.id === competitor.id;
  }
}
