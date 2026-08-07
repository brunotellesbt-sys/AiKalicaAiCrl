#!/usr/bin/env python3
"""
Balance simulator for roulette-driven adventure RPGs.

Mirrors the game's `buildVictoryOdds()` slice model so you can tune difficulty against
numbers instead of vibes. No dependencies — standard library only.

The point of this tool is that per-fight intuition is badly miscalibrated for run-based
games: a 75% win rate feels generous but is a 3.2% chance of clearing a 12-fight ladder.
Always check `run` before arguing about a single fight.

What is exact and what is a model
---------------------------------
`build_victory_odds()` and `gym_squad_size()` are faithful ports — trust those numbers.
`projected_team()` and `projected_enemy()` are *approximations* of how a player and the
rosters grow over a run; the real values come from live dex data and player choices. So
read the SHAPE of the curve and the DELTA between two settings, not the absolute
percentages. Comparing "before vs after a constant change" is what this tool is for.

Subcommands
-----------
  fight   win probability for one specific encounter, with the slice breakdown
  curve   win probability across a whole ladder, for a diligent and a neglectful player
  run     Monte Carlo completion rate for a full run (lives, potions, retries)
  sweep   how a tuning constant changes completion rate, across a range

Examples
--------
  python odds_sim.py fight --team 3,3,4,5 --round 5 --enemy 4,4,5,5,5,6 --type-slices -2
  python odds_sim.py curve --mode classic
  python odds_sim.py run --mode type-advantage --lives 3 --trials 20000
  python odds_sim.py sweep --constant enemy-power-weight --from 0.3 --to 0.8 --steps 6
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass, field

# --------------------------------------------------------------------------- constants
# These mirror the game's tuning constants. Override them from the CLI to test a change
# before you make it in the TypeScript.

ENEMY_POWER_WEIGHT = 0.5   # how much of the opponent's raw power reaches the wheel
MAX_ADVANTAGE_SLICES = 3   # cap on the type-matchup tilt, either direction
BASE_YES = 1               # free "you might just win" slice
BASE_NO = 1                # free "you might just lose" slice
LADDER_LENGTH = 13         # 8 gyms + 4 elite four + 1 champion
ENDGAME_SIZE = 6           # elite four and champion always field a full squad

# Enemy squad size per gym, as (player_team_size_threshold, squad_size) pairs. Mirrors
# GYM_SIZE_RULES: read each row as "first threshold the player's team fits into".
#
# The rules are deliberately asymmetric — early gyms only grow if the player already has
# a bench, so a one-Pokémon run never faces a full squad, while the 8th gym is always 6.
# Simulating with flat sizes makes the early game look far more brutal than it is, which
# is exactly the kind of false signal that leads to over-correcting the constants.
GYM_SIZE_RULES: list[list[tuple[float, int]]] = [
    [(1, 2), (math.inf, 3)],
    [(1, 2), (3, 3), (math.inf, 4)],
    [(2, 3), (math.inf, 4)],
    [(2, 3), (3, 4), (math.inf, 5)],
    [(3, 4), (math.inf, 5)],
    [(4, 4), (5, 5), (math.inf, 6)],
    [(4, 5), (math.inf, 6)],
    [(math.inf, 6)],
]


def gym_squad_size(gym_index: int, player_team_size: int) -> int:
    """Port of gymLeaderTeamSize(): squad size scales off the player's own team."""
    if gym_index >= len(GYM_SIZE_RULES):
        return ENDGAME_SIZE
    for threshold, size in GYM_SIZE_RULES[gym_index]:
        if player_team_size <= threshold:
            return size
    return ENDGAME_SIZE


@dataclass
class Odds:
    """A bag of Yes/No slices, exactly like the game's WheelItem[]."""

    yes: int = 0
    no: int = 0
    reasons: list[str] = field(default_factory=list)

    def add_yes(self, n: int, why: str) -> None:
        if n <= 0:
            return
        self.yes += n
        self.reasons.append(f"  +{n:>3} YES   {why}")

    def add_no(self, n: int, why: str) -> None:
        if n <= 0:
            return
        self.no += n
        self.reasons.append(f"  +{n:>3} NO    {why}")

    @property
    def total(self) -> int:
        return self.yes + self.no

    @property
    def p_win(self) -> float:
        return self.yes / self.total if self.total else 0.0


def build_victory_odds(
    player_powers: list[int],
    current_round: int,
    *,
    enemy_powers: list[int] | None = None,
    type_slices: int = 0,
    x_attacks: int = 0,
    type_advantage_mode: bool = False,
    flat_difficulty: int | None = None,
    enemy_power_weight: float = ENEMY_POWER_WEIGHT,
    max_advantage_slices: int = MAX_ADVANTAGE_SLICES,
) -> Odds:
    """Port of buildVictoryOdds(). Keep this in lockstep with the TypeScript."""
    enemy_powers = enemy_powers or []
    odds = Odds()

    odds.add_yes(BASE_YES, "base")

    player_power = sum(player_powers)
    odds.add_yes(player_power, f"team power ({len(player_powers)} members)")

    if x_attacks and player_powers:
        average = player_power / len(player_powers)
        odds.add_yes(math.floor(x_attacks * average), f"{x_attacks}× X Attack")

    odds.add_no(BASE_NO, "base")

    if type_advantage_mode and enemy_powers:
        enemy_power = sum(enemy_powers)
        odds.add_no(
            math.ceil(enemy_power * enemy_power_weight),
            f"enemy power {enemy_power} × {enemy_power_weight}",
        )
        # Only past the FIRST missing member — early opponents get one extra on purpose.
        outnumbered = max(0, len(enemy_powers) - len(player_powers) - 1)
        odds.add_no(outnumbered, "outnumbered")
    else:
        penalty = flat_difficulty if flat_difficulty is not None else current_round
        odds.add_no(penalty, "difficulty (badges earned)")

    slices = max(-max_advantage_slices, min(max_advantage_slices, type_slices))
    if slices > 0:
        odds.add_yes(slices, "type advantage")
    elif slices < 0:
        odds.add_no(-slices, "type disadvantage")

    return odds


# ------------------------------------------------------------------- player progression


def projected_team(round_index: int, *, diligent: bool = True) -> list[int]:
    """
    A plausible player team at a given rung of the ladder.

    Diligent: catches and evolves on schedule, reaching a full six by the late gyms.
    Neglectful: skips catching, keeps a small underleveled team. Both matter — a balance
    change that only helps one of them is usually the wrong change.
    """
    if diligent:
        # A catch chance sits before each gym, so a player who takes them arrives at the
        # first gym with the starter plus one, and fills six slots by the mid game.
        size = min(6, 2 + round_index)
        avg = min(5, 1 + round_index * 0.5)
    else:
        size = min(3, 1 + round_index // 3)
        avg = min(3, 1 + round_index * 0.2)
    return [max(1, round(avg))] * size


def projected_enemy(round_index: int, player_size: int) -> list[int]:
    """
    Opponent squad at a given rung.

    Size comes from the real scaling table (it reads the player's team size), power ramps
    with the ladder — roughly matching rosters that go unevolved early, fully evolved from
    the 4th gym, and Mega-capable from the 5th.
    """
    size = gym_squad_size(round_index, player_size)
    power = min(6, 2 + round_index * 0.45)
    return [max(1, round(power))] * size


# ------------------------------------------------------------------------- subcommands


def cmd_fight(args: argparse.Namespace) -> None:
    team = parse_powers(args.team)
    enemy = parse_powers(args.enemy) if args.enemy else []
    odds = build_victory_odds(
        team,
        args.round,
        enemy_powers=enemy,
        type_slices=args.type_slices,
        x_attacks=args.x_attacks,
        type_advantage_mode=bool(enemy),
        enemy_power_weight=args.enemy_power_weight,
        max_advantage_slices=args.max_advantage_slices,
    )

    print(f"\nTeam   {team}  (total power {sum(team)})")
    if enemy:
        print(f"Enemy  {enemy}  (total power {sum(enemy)})")
    print(f"Round  {args.round}\n")
    print("Slice breakdown:")
    for line in odds.reasons:
        print(line)
    print(f"\n  {odds.yes} YES / {odds.no} NO  ({odds.total} slices)")
    print(f"  P(win) = {odds.p_win:.1%}")

    for retries, label in ((1, "potion"), (2, "super potion"), (3, "hyper potion")):
        p = 1 - (1 - odds.p_win) ** (retries + 1)
        print(f"  with {label:<13} ({retries} re-spin{'s' if retries > 1 else ''}): {p:.1%}")
    print()


def cmd_curve(args: argparse.Namespace) -> None:
    ta = args.mode == "type-advantage"

    print(f"\nDifficulty curve — {args.mode} mode\n")
    print(f"{'rung':<6}{'diligent team':<18}{'P(win)':<10}{'neglectful':<16}{'P(win)':<10}")
    print("-" * 62)

    cumulative_ok = 1.0
    for r in range(LADDER_LENGTH):
        row = []
        for diligent in (True, False):
            team = projected_team(r, diligent=diligent)
            enemy = projected_enemy(r, len(team)) if ta else []
            odds = build_victory_odds(
                team,
                r,
                enemy_powers=enemy,
                type_advantage_mode=ta,
                enemy_power_weight=args.enemy_power_weight,
                max_advantage_slices=args.max_advantage_slices,
            )
            row.append((team, odds.p_win))

        (dt, dp), (nt, np_) = row
        cumulative_ok *= dp
        name = rung_name(r)
        print(f"{name:<6}{fmt_team(dt):<18}{dp:>6.1%}    {fmt_team(nt):<16}{np_:>6.1%}")

    print("-" * 62)
    print(f"\nDiligent player, no lives or potions, clears the whole ladder: {cumulative_ok:.2%}")
    print("(That product is the number players actually feel — not the per-fight rate.)\n")


def cmd_run(args: argparse.Namespace) -> None:
    ta = args.mode == "type-advantage"
    wins = 0
    depths: list[int] = []

    for _ in range(args.trials):
        lives = args.lives if ta else 1
        potions = args.potions
        rung = 0
        while rung < LADDER_LENGTH:
            team = projected_team(rung, diligent=not args.neglectful)
            enemy = projected_enemy(rung, len(team)) if ta else []
            p = build_victory_odds(
                team,
                rung,
                enemy_powers=enemy,
                type_advantage_mode=ta,
                enemy_power_weight=args.enemy_power_weight,
                max_advantage_slices=args.max_advantage_slices,
            ).p_win

            if random.random() < p:
                rung += 1
                continue

            # Potions buy re-spins before the loss stands.
            survived = False
            while potions > 0 and not survived:
                potions -= 1
                if random.random() < p:
                    survived = True
            if survived:
                rung += 1
                continue

            lives -= 1
            if lives <= 0:
                break
            # A life buys a replay of the same rung.

        if rung >= LADDER_LENGTH:
            wins += 1
        depths.append(rung)

    avg_depth = sum(depths) / len(depths)
    print(f"\n{args.trials:,} simulated runs — {args.mode} mode, "
          f"{args.lives if ta else 1} live(s), {args.potions} potion(s)\n")
    print(f"  completion rate : {wins / args.trials:.1%}")
    print(f"  average depth   : {avg_depth:.1f} / {LADDER_LENGTH} rungs ({rung_name(int(avg_depth))})")
    print(f"  median depth    : {sorted(depths)[len(depths) // 2]} rungs")
    hist(depths)
    print()


def cmd_sweep(args: argparse.Namespace) -> None:
    print(f"\nSweeping {args.constant} from {getattr(args, 'from')} to {args.to}\n")
    print(f"{'value':<10}{'completion':<14}{'avg depth':<12}")
    print("-" * 36)

    step = (args.to - getattr(args, "from")) / max(1, args.steps - 1)
    for i in range(args.steps):
        value = getattr(args, "from") + step * i
        ns = argparse.Namespace(**vars(args))
        if args.constant == "enemy-power-weight":
            ns.enemy_power_weight = value
        elif args.constant == "max-advantage-slices":
            ns.max_advantage_slices = int(round(value))
        elif args.constant == "lives":
            ns.lives = int(round(value))
        elif args.constant == "potions":
            ns.potions = int(round(value))

        wins, depths = simulate(ns)
        print(f"{value:<10.2f}{wins / ns.trials:<14.1%}{sum(depths) / len(depths):<12.1f}")
    print("\nPick the value that puts completion where you want it, then change the "
          "constant in the source and re-run `curve` to confirm the shape is still good.\n")


def simulate(args: argparse.Namespace) -> tuple[int, list[int]]:
    """Shared Monte Carlo core, used by `run` and `sweep`."""
    ta = args.mode == "type-advantage"
    wins, depths = 0, []
    for _ in range(args.trials):
        lives = args.lives if ta else 1
        potions = args.potions
        rung = 0
        while rung < LADDER_LENGTH:
            team = projected_team(rung, diligent=not args.neglectful)
            enemy = projected_enemy(rung, len(team)) if ta else []
            p = build_victory_odds(
                team, rung, enemy_powers=enemy, type_advantage_mode=ta,
                enemy_power_weight=args.enemy_power_weight,
                max_advantage_slices=args.max_advantage_slices,
            ).p_win
            if random.random() < p:
                rung += 1
                continue
            survived = False
            while potions > 0 and not survived:
                potions -= 1
                survived = random.random() < p
            if survived:
                rung += 1
                continue
            lives -= 1
            if lives <= 0:
                break
        if rung >= LADDER_LENGTH:
            wins += 1
        depths.append(rung)
    return wins, depths


# ------------------------------------------------------------------------------ helpers


def parse_powers(raw: str) -> list[int]:
    return [int(x) for x in raw.replace(" ", "").split(",") if x]


def fmt_team(team: list[int]) -> str:
    return f"{len(team)}× pow {team[0]}" if team else "empty"


def rung_name(r: int) -> str:
    if r < 8:
        return f"gym{r + 1}"
    if r < 12:
        return f"e4-{r - 7}"
    return "champ"


def hist(depths: list[int]) -> None:
    print("\n  where runs ended:")
    counts = [0] * (LADDER_LENGTH + 1)
    for d in depths:
        counts[d] += 1
    peak = max(counts) or 1
    for i, c in enumerate(counts):
        if not c:
            continue
        bar = "█" * max(1, round(40 * c / peak))
        label = "cleared" if i >= LADDER_LENGTH else rung_name(i)
        print(f"    {label:<8}{bar} {c / len(depths):.1%}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    def shared(p: argparse.ArgumentParser) -> None:
        p.add_argument("--enemy-power-weight", type=float, default=ENEMY_POWER_WEIGHT)
        p.add_argument("--max-advantage-slices", type=int, default=MAX_ADVANTAGE_SLICES)

    f = sub.add_parser("fight", help="odds for one encounter")
    f.add_argument("--team", required=True, help="comma-separated power values, e.g. 3,3,4,5")
    f.add_argument("--enemy", help="comma-separated enemy powers (omit for Classic mode)")
    f.add_argument("--round", type=int, default=0, help="battles already won")
    f.add_argument("--type-slices", type=int, default=0, help="-3..+3 matchup tilt")
    f.add_argument("--x-attacks", type=int, default=0)
    shared(f)
    f.set_defaults(func=cmd_fight)

    c = sub.add_parser("curve", help="difficulty across the whole ladder")
    c.add_argument("--mode", choices=["classic", "type-advantage"], default="classic")
    shared(c)
    c.set_defaults(func=cmd_curve)

    r = sub.add_parser("run", help="Monte Carlo completion rate")
    r.add_argument("--mode", choices=["classic", "type-advantage"], default="classic")
    r.add_argument("--lives", type=int, default=3)
    r.add_argument("--potions", type=int, default=0)
    r.add_argument("--trials", type=int, default=10000)
    r.add_argument("--neglectful", action="store_true", help="simulate a player who skips catching")
    shared(r)
    r.set_defaults(func=cmd_run)

    s = sub.add_parser("sweep", help="how one constant moves completion rate")
    s.add_argument("--constant", required=True,
                   choices=["enemy-power-weight", "max-advantage-slices", "lives", "potions"])
    s.add_argument("--from", type=float, required=True, dest="from")
    s.add_argument("--to", type=float, required=True)
    s.add_argument("--steps", type=int, default=6)
    s.add_argument("--mode", choices=["classic", "type-advantage"], default="type-advantage")
    s.add_argument("--lives", type=int, default=3)
    s.add_argument("--potions", type=int, default=0)
    s.add_argument("--trials", type=int, default=5000)
    s.add_argument("--neglectful", action="store_true")
    shared(s)
    s.set_defaults(func=cmd_sweep)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
