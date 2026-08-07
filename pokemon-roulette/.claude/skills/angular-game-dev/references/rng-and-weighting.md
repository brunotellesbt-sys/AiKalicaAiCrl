# Weighted randomness

Whenever outcomes shouldn't be equally likely (rare items, boss chances, prize wheel slices), use cumulative-weight selection instead of `Math.floor(Math.random() * items.length)`.

## Pattern

```ts
interface WeightedItem {
  weight: number;
  // ...other fields
}

private getTotalWeight(items: WeightedItem[]): number {
  return items.reduce((sum, item) => sum + item.weight, 0);
}

getRandomWeightedIndex(items: WeightedItem[]): number {
  const total = this.getTotalWeight(items);
  let random = Math.random() * total;
  let accumulated = 0;

  for (let i = 0; i < items.length; i++) {
    accumulated += items[i].weight;
    if (random < accumulated) {
      return i;
    }
  }
  return items.length - 1; // float-rounding fallback
}
```

This is the same math whether it's:
- picking which prize wheel segment wins
- picking a rare drop from a loot table
- picking which enemy/event triggers next

## Mapping a weighted pick to a visual angle (prize wheels)

If you also need to draw wedges proportional to weight and land an animation exactly on the winning one:

```ts
const arcSize = (2 * Math.PI) / totalWeight; // radians per "weight unit"

let winningAngle = 0;
for (let i = 0; i <= winningIndex; i++) {
  winningAngle += arcSize * items[i].weight;
}

const winningSegmentSize = arcSize * items[winningIndex].weight;
const offsetWithinSegment = Math.random() * winningSegmentSize; // land somewhere inside the slice, not always dead-center
const extraFullSpins = Math.floor(Math.random() * 4) + 1;

const finalRotation = extraFullSpins * 2 * Math.PI + (2 * Math.PI - winningAngle + offsetWithinSegment);
```

Pick the winning index *first*, independently of the animation — then compute the rotation needed to land on it. Don't try to derive the outcome from wherever the animation happens to stop; that couples randomness to animation timing and is easy to get subtly wrong (and easy to accidentally make exploitable/predictable).

## Testing weighted RNG

Because it's random, test the distribution statistically rather than the exact output:

```ts
it('should favor higher-weight items over many trials', () => {
  const items = [{ weight: 1 }, { weight: 9 }];
  let highWeightWins = 0;
  const trials = 1000;
  for (let i = 0; i < trials; i++) {
    if (service.getRandomWeightedIndex(items) === 1) highWeightWins++;
  }
  expect(highWeightWins).toBeGreaterThan(trials * 0.8); // ~90% expected, allow margin
});
```
