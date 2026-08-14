import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { WheelItem } from '../interfaces/wheel-item';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AudioService } from '../services/audio-service/audio.service';

@Component({
  selector: 'app-wheel',
  imports: [
    CommonModule,
    TranslatePipe
  ],
  templateUrl: './wheel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './wheel.component.css'
})
export class WheelComponent implements AfterViewInit, OnChanges, OnDestroy {

  /**
   * The canvases, resolved through the view rather than by element id.
   *
   * `document.getElementById('wheel')` returns the first match in the whole page, so a wheel
   * created while another one was still mounted — a roulette behind an open dialog, or the
   * moment two states overlap — would take hold of its neighbour's canvas and draw there.
   * The view query can only ever return this component's own.
   */
  @ViewChild('wheelCanvas') private wheelCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pointerCanvas') private pointerCanvasRef?: ElementRef<HTMLCanvasElement>;

  wheelCanvas!: HTMLCanvasElement;
  wheelCtx!: CanvasRenderingContext2D;
  pointerCanvas!: HTMLCanvasElement;
  pointerCtx!: CanvasRenderingContext2D;
  @Input() items: WheelItem[] = [];
  /**
   * Optional font scaling for wheel segment labels.
   * Useful for wheels with long labels on small screens.
   */
  @Input() fontScale: number = 1;
  @Output() selectedItemEvent = new EventEmitter<number>();
  /**
   * The slice the wheel actually stopped on.
   *
   * Hosts used to read the outcome back out of their own array with the emitted index. That
   * only held while nothing could reorder or resize that array between the spin starting
   * and finishing — and the odds builders rebuild it whenever the team changes, now with the
   * Yes/No slices dealt to fresh positions each time. A rebuild mid-spin would leave the
   * index pointing at a different slice than the one the pointer was measured against, so a
   * spin the player watched land on "No" could be recorded as a win.
   *
   * Emitting the measured slice removes the possibility rather than relying on the timing.
   */
  @Output() selectedSliceEvent = new EventEmitter<WheelItem>();

  /**
   * The items as they were when the spin was measured.
   *
   * Every angle in the animation is derived from this, so it has to stay put even if the
   * bound array is replaced underneath.
   */
  private spinItems: WheelItem[] = [];
  spinning = false;
  darkMode!: Observable<boolean>;

  canvasHeight: number;
  wheelWidth: number;
  cursorWidth: number;
  fontSize: number;
  currentRotation = 0;
  startTime = 0;
  totalRotations!: number;
  duration = Math.floor(Math.random() * (5000 - 3000)) + 3000;
  finalRotation = 0;
  /* Gold bolt with a near-black outline, so it stays readable over any slice colour. */
  pointerStrokeColor = '#1a1a00';
  pointerFillColor = '#ffd700';
  winningNumber!: number;
  currentSegment: string = '-';
  clickAudio!: HTMLAudioElement;
  
  private translatedItems: WheelItem[] = [];

  private readonly MIN_WHEEL_SIZE = 240;
  private readonly MAX_WHEEL_SIZE = 520;

  /** Ceiling on how far the canvas row may reach past its column, per side. */
  private readonly MAX_SIDE_BLEED = 16;

  /** Current bleed, in pixels per side. See `sideBleed`. */
  private bleed = 0;

  private readonly onResize = () => {
    this.computeCanvasSizes();
    // Redraw at current rotation (avoid visible reset while spinning)
    this.redraw(this.spinning ? this.currentRotation : 0);
  };

  constructor(
    private darkModeService: DarkModeService,
    private gameStateService: GameStateService,
    private translateService: TranslateService,
    private audioService: AudioService
  ) {
    this.clickAudio = this.audioService.createAudio('./click.mp3');
    this.darkMode = this.darkModeService.darkMode$;

    // Responsive sizing: on mobile the wheel was too small (0.50 of min dimension).
    // We compute a size that fits the viewport width while still keeping enough room
    // for the pointer canvas.
    this.canvasHeight = 300;
    this.wheelWidth = 300;
    this.cursorWidth = 40;
    this.fontSize = this.wheelWidth / 24;
    this.computeCanvasSizes();
  }

  /**
   * Width the wheel may actually occupy.
   *
   * Prefers the container's own content box, which already has the page's padding and any
   * side panel taken out of it. Falls back to the document width — still better than
   * window.innerWidth, which includes the scrollbar — and to the viewport only when the
   * component has not been laid out yet.
   */
  private availableWidth(viewportWidth: number): number {
    // The screen, never the wheel's own box.
    //
    // Measuring an ancestor of the canvas is what made the wheel shrink a step on every tap:
    // the row holding the canvases sizes itself to fit them, so reading a width from
    // anywhere inside it fed the wheel its own size back and each layout pass took another
    // bite. The viewport cannot do that — it is the same number before and after a draw.
    //
    // What the layout takes out of it is handled separately, by `sideBleed()`.
    return document.documentElement?.clientWidth || viewportWidth;
  }

  /**
   * How far the canvas row may reach past the page's side padding, per side.
   *
   * The wheel is sized against the screen, but it sits inside a padded column — so without
   * this the padding is charged twice and the wheel comes out that much narrower than the
   * margin it was given. Reading the column's width (a `width: 100%` box, unaffected by
   * what is drawn in it) says exactly how much padding to reclaim, with a ceiling so a
   * narrow column on a wide screen cannot let the row swing out over its neighbours.
   */
  private sideBleed(viewport: number): number {
    const column = this.wheelCanvas?.parentElement?.parentElement;
    const width = column?.clientWidth ?? 0;
    if (width <= 0 || width >= viewport) return 0;

    return Math.min(Math.floor((viewport - width) / 2), this.MAX_SIDE_BLEED);
  }

  // Keep the wheel readable when rotating the phone or resizing the browser.
  // (Using a method instead of a HostListener avoids importing more decorators.)
  private computeCanvasSizes(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= 576;

    // Pointer canvas width
    this.cursorWidth = isMobile ? 28 : 40;

    // Leave some space for padding + pointer + a small gap.
    const viewport = this.availableWidth(vw);
    this.bleed = isMobile ? this.sideBleed(viewport) : 0;

    // 6px off each screen edge and 5px between rim and bolt on a phone.
    //
    // Converged over three tries: 12px left visible slack, 4px read as spilling off the
    // screen, 8px was close but still short. 6px is the narrowest margin that still reads
    // as a margin — enough background beside the rim to look placed rather than cropped,
    // and no more than that.
    const horizontalPadding = isMobile ? 12 : 24;
    const gap = isMobile ? 5 : 8;
    // The wheel takes everything the row has left once the bolt and its gap are placed, so
    // it reaches both margins and the only slack sits where the bolt is.
    const maxByWidth = Math.max(0, viewport - this.cursorWidth - gap - horizontalPadding);
    const maxByHeight = vh * (isMobile ? 0.62 : 0.50);

    const size = Math.floor(
      Math.max(
        this.MIN_WHEEL_SIZE,
        Math.min(this.MAX_WHEEL_SIZE, maxByWidth, maxByHeight)
      )
    );

    this.canvasHeight = size;
    this.wheelWidth = size;
    const baseFont = this.wheelWidth / (isMobile ? 20 : 24);
    this.fontSize = baseFont * (this.fontScale || 1);

    // Crowded wheels get a ceiling on top of the proportional size. This used to live in
    // ngAfterViewInit, so it only applied to the slices the wheel was born with: a wheel
    // that later grew to 32 items redrew them at the uncapped size and the labels collided.
    if (this.items.length >= 32) {
      this.fontSize = Math.min(this.fontSize, 10);
    } else if (this.items.length >= 16) {
      this.fontSize = Math.min(this.fontSize, 14);
    }
  }

  /**
   * Pushes the computed sizes onto the canvas elements.
   *
   * Always immediately before drawing, never through a template binding: writing `width`
   * clears the bitmap, and Angular writes its bindings *after* the lifecycle hooks that
   * draw. Doing it here means the wipe happens first and the paint survives it.
   */
  private applyCanvasSizes(): void {
    if (!this.wheelCanvas || !this.pointerCanvas) return;

    // Let the row spill back over the page padding the wheel was already measured against,
    // so the rim reaches its margin instead of being clipped short of it.
    const row = this.wheelCanvas.parentElement;
    if (row) {
      // max-width has to move with the margins: the row is capped at 100% of the column, so
      // negative margins alone would just be clamped straight back and the canvas squeezed.
      row.style.marginLeft = this.bleed > 0 ? `${-this.bleed}px` : '';
      row.style.marginRight = row.style.marginLeft;
      row.style.maxWidth = this.bleed > 0 ? `calc(100% + ${this.bleed * 2}px)` : '';
    }

    if (this.wheelCanvas.width !== this.wheelWidth) this.wheelCanvas.width = this.wheelWidth;
    if (this.wheelCanvas.height !== this.canvasHeight) this.wheelCanvas.height = this.canvasHeight;
    if (this.pointerCanvas.width !== this.cursorWidth) this.pointerCanvas.width = this.cursorWidth;
    if (this.pointerCanvas.height !== this.canvasHeight) this.pointerCanvas.height = this.canvasHeight;
  }

  /** Size, then paint — the only order in which the paint is guaranteed to stay on screen. */
  private redraw(rotation = 0): void {
    if (!this.wheelCtx || !this.pointerCtx) return;

    this.applyCanvasSizes();
    this.drawWheel(rotation);
    this.drawPointer();
  }

  ngAfterViewInit(): void {
    const wheel = this.wheelCanvasRef?.nativeElement;
    const pointer = this.pointerCanvasRef?.nativeElement;
    if (!wheel || !pointer) return;

    this.wheelCanvas = wheel;
    this.wheelCtx = wheel.getContext('2d')!;
    this.pointerCanvas = pointer;
    this.pointerCtx = pointer.getContext('2d')!;

    // The constructor sized the wheel before it had a container to measure, so redo it now
    // that there is one.
    this.computeCanvasSizes();

    // Wait for translations to be ready
    this.translateService.get('wheel.spin').subscribe(() => {
      this.preprocessTranslations();
      this.redraw();
    });

    // Resize after view init so bindings apply with the latest viewport.
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const itemsChanged = changes['items'] && !changes['items'].firstChange;
    const fontScaleChanged = changes['fontScale'] && !changes['fontScale'].firstChange;

    if (itemsChanged || fontScaleChanged) {
      // Recompute sizes so fontScale is applied consistently.
      this.computeCanvasSizes();
      this.translateService.get('wheel.spin').subscribe(() => {
        this.preprocessTranslations();
        // If items change while the wheel is spinning, redraw at the current rotation
        // to avoid a visible "reset".
        this.redraw(this.spinning ? this.currentRotation : 0);
      });
    }
  }

  private preprocessTranslations(): void {
    this.translatedItems = this.items.map(item => ({
      ...item,
      text: this.safeInstant(item.text)
    }));
  }

  /**
   * ngx-translate returns the key itself when a translation isn't available yet.
   * We never want to render raw keys on the wheel (e.g. "items.super-potion.name").
   */
  private safeInstant(key: string): string {
    const k = (key ?? '').toString();
    if (!k) return '';
    const t = this.translateService.instant(k);
    if (!t || t === k) return this.humanizeKey(k);
    return t;
  }

  private humanizeKey(key: string): string {
    const k = (key ?? '').toString();
    // items.super-potion.name -> Super Potion
    const m1 = k.match(/^items\.(.+)\.name$/);
    if (m1?.[1]) return this.titleCaseFromToken(m1[1]);

    // items.super-potion.description -> Super Potion
    const m2 = k.match(/^items\.(.+)\.description$/);
    if (m2?.[1]) return this.titleCaseFromToken(m2[1]);

    // pokemon.meganium -> Meganium
    const m3 = k.match(/^pokemon\.(.+)$/);
    if (m3?.[1]) return this.titleCaseFromToken(m3[1]);

    const last = k.split('.').pop() || k;
    return this.titleCaseFromToken(last);
  }

  private titleCaseFromToken(token: string): string {
    return (token || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private drawWheel(rotation = 0): void {
    const centerX = this.wheelCanvas.width / 2;
    const centerY = this.wheelCanvas.height / 2;
    const radius = (this.wheelCanvas.width / 2);

    const totalWeight = this.getTotalWeights();
    const arcSize = (2 * Math.PI) / (totalWeight);
    this.wheelCtx.clearRect(0, 0, this.wheelCanvas.width, this.wheelCanvas.height);

    let startAngle = rotation;
    for (let index = 0; index < this.translatedItems.length; index++) {
      const item = this.translatedItems[index];
      const segmentSize = arcSize * item.weight;
      const endAngle = startAngle + segmentSize;

      /** Draw the segment */
      this.wheelCtx.beginPath();
      this.wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
      this.wheelCtx.lineTo(centerX, centerY);
      this.wheelCtx.fillStyle = item.fillStyle;
      this.wheelCtx.fill();

      if (this.translatedItems.length < 160) {
        /** Draw the text */
        this.wheelCtx.save();
        this.wheelCtx.translate(centerX, centerY);
        this.wheelCtx.rotate(startAngle + segmentSize / 2);
        this.wheelCtx.fillStyle = '#fff';
        this.wheelCtx.textAlign = 'right';
        this.drawSegmentLabel(item.text, radius, segmentSize);
        this.wheelCtx.restore();
      }

      startAngle = endAngle;
    }
  }

  /**
   * Draws a segment label so it always stays inside its own wedge.
   *
   * Labels are right-aligned at the rim and grow inwards, so a long one ("You Defeat Team
   * Galactic") used to run straight through the hub and out the other side. This keeps the
   * wheel exactly the same size and makes the text fit instead: wrap onto extra lines when
   * the wedge is wide enough, then shrink, and only ellipsize as a last resort.
   */
  private drawSegmentLabel(text: string, radius: number, segmentSize: number): void {
    if (!text) return;

    const ctx = this.wheelCtx;
    const rimPadding = 7;
    // Keep the hub clear — text meeting at the centre is what looked broken.
    const hubPadding = radius * 0.16;
    const maxLen = radius - rimPadding - hubPadding;
    if (maxLen <= 0) return;

    const minFont = 8;

    for (let size = this.fontSize; size >= minFont; size -= 0.5) {
      ctx.font = `${size}px Arial`;
      const lineHeight = size * 1.1;

      // Prefer one line, then two, then three — but only when the extra lines physically
      // fit. A wedge narrows towards the hub, so the limit has to be measured where the
      // longest line reaches, not at its midpoint, or stacked text spills into neighbours.
      for (let lineCount = 1; lineCount <= 3; lineCount++) {
        const lines = this.wrapToWidth(text, maxLen, lineCount);
        if (!lines || lines.length !== lineCount) continue;

        const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
        const wedgeHeight = segmentSize * Math.max(0, radius - rimPadding - widest);

        // One line is always allowed — that is what the wheel has always drawn.
        if (lineCount > 1 && lineCount * lineHeight > wedgeHeight) continue;

        const firstY = 5 - ((lineCount - 1) * lineHeight) / 2;
        lines.forEach((line, i) => ctx.fillText(line, radius - rimPadding, firstY + i * lineHeight));
        return;
      }
    }

    ctx.font = `${minFont}px Arial`;
    ctx.fillText(this.ellipsize(text, maxLen), radius - rimPadding, 5);
  }

  /** Splits on words to fit `maxLen`, or null when it cannot within `maxLines`. */
  private wrapToWidth(text: string, maxLen: number, maxLines: number): string[] | null {
    const ctx = this.wheelCtx;
    if (ctx.measureText(text).width <= maxLen) return [text];
    if (maxLines < 2) return null;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;

    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxLen) {
        current = candidate;
        continue;
      }
      // A single word wider than the wedge can't be wrapped — shrink instead.
      if (!current) return null;
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) return null;
    }

    if (current) lines.push(current);
    return lines.length <= maxLines ? lines : null;
  }

  private ellipsize(text: string, maxLen: number): string {
    const ctx = this.wheelCtx;
    if (ctx.measureText(text).width <= maxLen) return text;

    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxLen) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  }

  /**
   * The marker that reads off the winning slice: a lightning bolt aimed at the wheel.
   *
   * Every coordinate is a fraction of `cursorWidth`, which shrinks on phones, so the bolt
   * scales with the wheel instead of needing a second set of numbers for mobile.
   */
  drawPointer(): void {
    this.pointerCtx.clearRect(0, 0, this.pointerCanvas.width, this.pointerCanvas.height);
    this.pointerCtx.save();

    const cw = this.cursorWidth;
    const left = this.pointerCanvas.width - cw;
    const top = this.pointerCanvas.height / 2 - cw / 2;

    this.pointerCtx.beginPath();
    this.pointerCtx.moveTo(left, top + cw * 0.5);
    this.pointerCtx.lineTo(left + cw * 0.5, top + cw);
    this.pointerCtx.lineTo(left + cw * 0.45, top + cw * 0.75);
    this.pointerCtx.lineTo(left + cw * 0.65, top + cw * 0.85);
    this.pointerCtx.lineTo(left + cw * 0.65, top + cw * 0.65);
    this.pointerCtx.lineTo(left + cw, top + cw * 0.75);
    this.pointerCtx.lineTo(left + cw, top + cw * 0.5);
    this.pointerCtx.lineTo(left + cw * 0.4, top + cw * 0.5);
    this.pointerCtx.lineTo(left + cw * 0.5, top + cw * 0.65);
    this.pointerCtx.lineTo(left, top + cw * 0.5);
    this.pointerCtx.closePath();

    this.pointerCtx.fillStyle = this.pointerFillColor;
    this.pointerCtx.fill();
    this.pointerCtx.strokeStyle = this.pointerStrokeColor;
    this.pointerCtx.lineWidth = 1.5;
    this.pointerCtx.stroke();

    this.pointerCtx.restore();
  }

  spinWheel(): void {
    if (this.spinning) {
      return;
    }

    // An empty wheel has no total weight, so the arc size would be 2π/0 and every angle
    // downstream becomes NaN — the canvas silently draws nothing and the spin never
    // resolves, which reads to the player as the game having frozen. Callers are meant to
    // leave the state before it can happen; refusing here means a caller that forgets
    // shows a dead button instead of taking the run down with it.
    if (!this.items?.length || this.getTotalWeights() <= 0) {
      return;
    }

    this.spinning = true;
    this.spinItems = [...this.items];
    this.gameStateService.setWheelSpinning(this.spinning);


    this.startTime = performance.now();
    const totalWeight = this.getTotalWeights();
    const arcSize = (2 * Math.PI) / (totalWeight);

    this.winningNumber = this.getRandomWeightedIndex();

    this.totalRotations = Math.floor(Math.random() * 4) + 1;

    let winningAngle = 0;
    const winningSegmentSize = arcSize * this.items[this.winningNumber].weight;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      winningAngle += arcSize * item.weight;
      if (index === this.winningNumber) {
        break;
      }
    }

    const offset = Math.random() * winningSegmentSize;
    this.finalRotation = this.totalRotations * 2 * Math.PI + (2 * Math.PI - winningAngle + offset);

    requestAnimationFrame(this.animate.bind(this));
  }

  private animate(currentTime: number): void {
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    this.currentRotation = easedProgress * this.finalRotation;

    const totalWeight = this.getTotalWeights();

    this.drawWheel(this.currentRotation);

    if (progress < 1) {
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.spinning = false;
      // The snapshot, not the live array: they are the same object unless something replaced
      // it mid-spin, which is exactly the case this guards.
      this.selectedSliceEvent.emit(this.spinItems[this.winningNumber] ?? this.items[this.winningNumber]);
      this.selectedItemEvent.emit(this.winningNumber);
      this.gameStateService.setWheelSpinning(false);
    }

    const segment = this.getCurrentSegment();

    if (segment !== this.currentSegment) {
      this.currentSegment = segment;
      this.audioService.playAudio(this.clickAudio, 1.0);
    }
  }

  private getCurrentSegment(): string {
    const totalWeight = this.getTotalWeights();

    const currentAngle = (2 * Math.PI - (this.currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    let accumulatedWeight = 0;

    for (const item of this.translatedItems) {
      accumulatedWeight += item.weight;
      const segmentEnd = (accumulatedWeight / totalWeight) * 2 * Math.PI;

      if (currentAngle <= segmentEnd) {
        return item.text;
      }
    }
    return '-';
  }

  /**
   * Weights come from `items`, never from `translatedItems`.
   *
   * `translatedItems` is a render-time copy that only differs in its `text`, and it is
   * rebuilt on a lifecycle hook — so it can lag behind. spin() already measured its angles
   * against `items`, so reading weights from the other array risked the wheel stopping on
   * one segment while a different index was reported as the winner.
   */
  private getTotalWeights(): number {
    return this.items.reduce((sum, item) => sum + item.weight, 0);
  }

  getRandomWeightedIndex(): number {
    const totalWeight = this.getTotalWeights();
    let random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let i = 0; i < this.items.length; i++) {
      accumulatedWeight += this.items[i].weight;
      if (random < accumulatedWeight) {
        return i;
      }
    }
    return this.items.length - 1;
  }
}
