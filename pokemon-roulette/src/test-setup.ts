import { vi } from 'vitest';

/**
 * Jasmine compatibility for the Vitest runner.
 *
 * The generated specs were written against Karma + Jasmine and use exactly two of its APIs:
 * `jasmine.createSpyObj()` to stub a service, and the `jasmine.SpyObj<T>` type to hold it.
 * Vitest provides neither. Supplying both here keeps seventeen spec files working as
 * written, rather than rewriting them all to say `vi.fn()` — which would be pure churn for
 * tests that only assert the component can be constructed.
 *
 * The matching type declarations live in src/jasmine-compat.d.ts.
 */
function createSpyObj(baseName: string | string[], methodNames?: string[]): Record<string, unknown> {
  // Jasmine allows both createSpyObj('Name', ['a']) and createSpyObj(['a']).
  const methods = Array.isArray(baseName) ? baseName : (methodNames ?? []);

  const spyObj: Record<string, unknown> = {};
  for (const method of methods) {
    spyObj[method] = vi.fn();
  }

  return spyObj;
}

(globalThis as Record<string, unknown>)['jasmine'] = { createSpyObj };

// Jasmine exposes spyOn as a bare global; Vitest namespaces it under `vi`.
(globalThis as Record<string, unknown>)['spyOn'] = vi.spyOn;

// jsdom implements no media queries, and DarkModeService asks for the OS preference the
// moment it is constructed. Report "light" rather than letting every component that
// reaches it die on a missing function.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/*
  jsdom implements <canvas> as far as the element and then throws "Not implemented:
  HTMLCanvasElement's getContext()" for every call, unless the native `canvas` package is
  installed. The wheel draws on every change, so a run printed dozens of those lines and a
  genuine failure had to be hunted for among them.

  A no-op 2D context is enough: no spec asserts on pixels, they assert on the selection maths
  that decides what gets drawn. Installing the native package instead would mean a compiler
  toolchain in CI to test drawing nobody checks.
*/
if (typeof HTMLCanvasElement !== 'undefined') {
  const noopContext = new Proxy(
    { canvas: null, measureText: () => ({ width: 0 }) },
    {
      get: (target: Record<string, unknown>, prop: string) =>
        prop in target ? target[prop] : () => undefined,
    }
  );

  HTMLCanvasElement.prototype.getContext = ((kind: string) =>
    kind === '2d' ? noopContext : null) as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom ships no ResizeObserver, which EndGameComponent constructs up front.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
