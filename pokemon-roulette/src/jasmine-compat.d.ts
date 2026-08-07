import type { Mock } from 'vitest';

/**
 * Types for the Jasmine shim installed by src/test-setup.ts.
 *
 * The specs were generated against Karma + Jasmine and reference `jasmine.SpyObj<T>` and
 * `jasmine.createSpyObj()`. Declaring them here lets those files type-check under the
 * Vitest runner without being rewritten.
 */
declare global {
  namespace jasmine {
    /** A stub whose declared methods are Vitest mocks. */
    type SpyObj<T> = T & { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> : T[K] };

    function createSpyObj<T = Record<string, Mock>>(baseName: string, methodNames: string[]): SpyObj<T>;
    function createSpyObj<T = Record<string, Mock>>(methodNames: string[]): SpyObj<T>;
  }

  /** Jasmine's bare global; mapped to vi.spyOn by the setup file. */
  const spyOn: typeof import('vitest')['vi']['spyOn'];
}

export {};
