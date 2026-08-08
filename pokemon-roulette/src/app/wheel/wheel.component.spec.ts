import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WheelComponent } from './wheel.component';

/**
 * A deterministic stand-in for Math.random, so a distribution test cannot flake.
 *
 * These specs draw thousands of samples and compare observed frequencies against expected
 * ones. Against the real Math.random that comparison is itself a gamble — and it was being
 * lost: the weighted case asserted the observed share of a p = 0.5 slice landed within 0.01
 * of a half over 10 000 draws, which is two standard errors, so it failed roughly one run
 * in twenty. Seeding makes every run identical: the suite either always passes or always
 * fails, and a failure can be reproduced instead of shrugged at.
 *
 * mulberry32 — small, uniform enough for this, and no dependency.
 */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How far an observed frequency may sit from the expected one before the test fails.
 *
 * Derived from the binomial standard error rather than fixed, because a single absolute
 * number cannot serve probabilities two orders of magnitude apart. The old 0.01 was 2σ for
 * the p = 0.5 slice — tight enough to fail on chance alone — and 39σ for the p = 1/150 case,
 * loose enough that a badly broken implementation would still have passed.
 *
 * Four sigma is far outside anything sampling noise produces, and with the seed fixed the
 * margin only has to absorb this one sequence.
 */
function tolerance(expected: number, draws: number, sigmas = 4): number {
  return sigmas * Math.sqrt((expected * (1 - expected)) / draws);
}

describe('WheelComponent', () => {
  let component: WheelComponent;
  let fixture: ComponentFixture<WheelComponent>;
  let realRandom: () => number;

  beforeEach(async () => {
    realRandom = Math.random;
    Math.random = seededRandom(0x5eed);

    await TestBed.configureTestingModule({
      imports: [WheelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WheelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    Math.random = realRandom;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a fair distribuition of chances', () => {
    const numRuns = 10000;
    const expectedProbability = 1 / 8;
    const margin = tolerance(expectedProbability, numRuns);

    component.items = [
      { text: '1', weight: 1, fillStyle: 'red' },
      { text: '2', weight: 1, fillStyle: 'green' },
      { text: '3', weight: 1, fillStyle: 'blue' },
      { text: '4', weight: 1, fillStyle: 'yellow' },
      { text: '5', weight: 1, fillStyle: 'orange' },
      { text: '6', weight: 1, fillStyle: 'black' },
      { text: '7', weight: 1, fillStyle: 'purple' },
      { text: '8', weight: 1, fillStyle: 'pink' }
    ];
    fixture.detectChanges();

    const results: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    for (let i = 0; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedProbability)).toBeLessThan(margin);
    }
  });

  it('should have a fair distribuition for large numbers of elements', () => {
    const numRuns = 100000;
    const expectedProbability = 1 / 150;
    const margin = tolerance(expectedProbability, numRuns);

    component.items = [];
    const possibleColors = ['red', 'green', 'blue', 'yellow', 'orange', 'black', 'purple', 'pink'];

    for (let i = 1; i <= 150; i++) {
      const color = possibleColors[Math.floor(Math.random() * possibleColors.length)];
      component.items.push({ text: `${i}`, weight: 1, fillStyle: color });
    }
    fixture.detectChanges();

    const results: number[] = new Array(component.items.length).fill(0);
    const occurrences: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
      occurrences[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    const meanProbability = probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length;
    console.log(`Mean probability: ${(meanProbability * 100).toFixed(2)}%`);
    expect(Math.abs(meanProbability - expectedProbability)).toBeLessThan(margin);

    for (let i = 0; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedProbability)).toBeLessThan(margin);
    }
  });

  it('the distribuition should respect the weight', () => {
    const numRuns = 10000;
    const expectedForLower = 1 / 14;
    const expectedForHigher = 1 / 2;
    const lowerMargin = tolerance(expectedForLower, numRuns);
    const higherMargin = tolerance(expectedForHigher, numRuns);

    component.items = [
      { text: '1', weight: 7, fillStyle: 'red' },
      { text: '2', weight: 1, fillStyle: 'green' },
      { text: '3', weight: 1, fillStyle: 'blue' },
      { text: '4', weight: 1, fillStyle: 'yellow' },
      { text: '5', weight: 1, fillStyle: 'orange' },
      { text: '6', weight: 1, fillStyle: 'black' },
      { text: '7', weight: 1, fillStyle: 'purple' },
      { text: '8', weight: 1, fillStyle: 'pink' }
    ];
    fixture.detectChanges();

    const results: number[] = new Array(component.items.length).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const result = component.getRandomWeightedIndex();
      results[result]++;
    }

    const probabilities = results.map(result => result / numRuns);

    expect(Math.abs(probabilities[0] - expectedForHigher)).toBeLessThan(higherMargin);

    for (let i = 1; i < probabilities.length; i++) {
      expect(Math.abs(probabilities[i] - expectedForLower)).toBeLessThan(lowerMargin);
    }
  });
});
