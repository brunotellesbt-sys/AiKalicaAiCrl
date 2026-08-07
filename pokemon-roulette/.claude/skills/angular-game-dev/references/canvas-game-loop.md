# Canvas animation / game loop pattern

Use this for anything that animates continuously: spinning wheels, sprite movement, particle effects, health bar fills, etc.

## Setup: get the context after the view exists

```ts
export class WheelComponent implements AfterViewInit, OnDestroy {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  ngAfterViewInit(): void {
    this.canvas = <HTMLCanvasElement>document.getElementById('wheel');
    this.ctx = this.canvas.getContext('2d')!;
    // set canvas.width/height explicitly here, matching computed layout size —
    // don't rely on CSS alone, it distorts the drawing buffer
  }
}
```

Canvas dimensions are two different things: the CSS size (layout) and the `width`/`height` attributes (drawing buffer resolution). Always set both, and recompute on resize.

## The loop: `requestAnimationFrame`, driven by elapsed time — not frame count

```ts
private startTime = 0;
private duration = 3000; // ms

spin(): void {
  this.startTime = performance.now();
  requestAnimationFrame(this.animate.bind(this));
}

private animate(currentTime: number): void {
  const elapsed = currentTime - this.startTime;
  const progress = Math.min(elapsed / this.duration, 1);
  const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

  this.currentRotation = eased * this.finalRotation;
  this.draw(this.currentRotation);

  if (progress < 1) {
    requestAnimationFrame(this.animate.bind(this));
  } else {
    this.onAnimationComplete();
  }
}
```

Why elapsed-time-based progress instead of incrementing rotation by a fixed amount per frame: it makes the animation duration consistent regardless of the user's monitor refresh rate (60Hz vs 120Hz vs a throttled background tab).

## Responsive canvas sizing

Recompute canvas pixel size from the viewport, don't hardcode:

```ts
private computeCanvasSize(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw <= 576;
  const maxByWidth = vw - horizontalPaddingAndChrome;
  const maxByHeight = vh * (isMobile ? 0.55 : 0.50);
  const size = Math.floor(Math.max(MIN_SIZE, Math.min(MAX_SIZE, maxByWidth, maxByHeight)));
  this.canvasSize = size;
}
```

Recompute on window resize (with a bound listener registered in `ngAfterViewInit` and removed in `ngOnDestroy`), and redraw at the *current* animation state rather than resetting to 0 — otherwise resizing mid-animation looks like a glitch.

```ts
private readonly onResize = () => {
  this.computeCanvasSize();
  this.canvas.width = this.canvasSize;
  this.canvas.height = this.canvasSize;
  this.draw(this.spinning ? this.currentRotation : 0);
};

ngAfterViewInit(): void {
  window.addEventListener('resize', this.onResize, { passive: true });
}
ngOnDestroy(): void {
  window.removeEventListener('resize', this.onResize);
}
```

## Sound effects tied to animation state changes

Play a sound only when a meaningful boundary is crossed (e.g. wheel ticks past a new segment), not every frame:

```ts
private lastSegment = '-';

private animate(t: number): void {
  // ...update currentRotation, draw()...
  const segment = this.getCurrentSegment();
  if (segment !== this.lastSegment) {
    this.lastSegment = segment;
    this.audioService.playAudio(this.tickSound, 1.0);
  }
}
```

Route audio through a small `AudioService` (wraps `HTMLAudioElement`) rather than `new Audio()` scattered in components, so volume/mute settings apply globally.
