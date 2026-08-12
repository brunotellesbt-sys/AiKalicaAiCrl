import { Component, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import {
  Competitor,
  TournamentGroup,
  TournamentMatch,
  TournamentService,
} from '../../services/tournament-service/tournament.service';

/** One column of the wall chart: a round's heading and the ties on that side of it. */
interface BracketColumn {
  label: string;
  ties: TournamentMatch[];
}

/** The knockout drawn as a cup wall chart: two halves converging on the final. */
interface BracketBoard {
  left: BracketColumn[];
  right: BracketColumn[];
  final: TournamentMatch | null;
  champion: Competitor | null;
}

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
   * The bracket, split into the two halves of the draw that meet in the final.
   *
   * A knockout draw is already two independent halves — the top half and the bottom half
   * of the field only ever meet at the end — so drawing it as one long left-to-right strip
   * throws away the shape everyone recognises from a cup wall chart, and on a phone it also
   * means scrolling through every round to find out who you play next.
   *
   * Laid out as halves it fits: both sides converge on the centre, the final is one card in
   * the middle instead of a column at the far right, and the number of columns is halved.
   *
   * `left` runs outside-in, `right` is reversed so it also runs outside-in when rendered
   * right-to-left, which is what makes the two sides mirror each other.
   */
  get board(): BracketBoard {
    const rounds = this.playedRounds;
    const final = this.finalRound;
    const upToFinal = final ? rounds.slice(0, -1) : rounds;

    const columns = upToFinal.map((round) => ({
      label: this.roundLabel(round),
      ties: this.contested(round),
    }));

    const left = columns.map(({ label, ties }) => ({
      label,
      ties: ties.slice(0, Math.ceil(ties.length / 2)),
    }));

    // Reversed so the right half also runs outside-in once the row is laid out
    // right-to-left, which is what makes the two sides mirror rather than repeat.
    const right = columns
      .map(({ label, ties }) => ({ label, ties: ties.slice(Math.ceil(ties.length / 2)) }))
      .reverse();

    return { left, right, final, champion: final?.winner ?? null };
  }

  /**
   * The deciding match, once the bracket is down to one.
   *
   * Null until then, so the centre column shows the trophy only when there is actually a
   * final to sit under it — an empty plinth halfway through a tournament would read as a
   * result that has already happened.
   */
  get finalRound(): TournamentMatch | null {
    const rounds = this.playedRounds;
    const last = rounds[rounds.length - 1];
    if (!last) return null;

    const ties = this.contested(last);
    return ties.length === 1 ? ties[0] : null;
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
