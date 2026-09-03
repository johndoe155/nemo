/**
 * Mobile render-resolution scaling. The passes render at a fraction of the
 * full buffer and the GPU upscales the soft/bloom-heavy result. Desktop is
 * never scaled (always 1.0). Two mechanisms: a static cap/floor, and an
 * AdaptiveRenderScale controller that steps between levels from frame times
 * (no-op when disabled).
 */

/** Mobile ceiling: never render above 75% resolution on touch devices. */
export const MOBILE_RENDER_SCALE_CAP = 0.75
/** Mobile floor: never go below 50% (below this the disc visibly softens). */
export const MOBILE_RENDER_SCALE_FLOOR = 0.5

/** Discrete scale levels, descending from cap to floor. */
const STEPS = [0.75, 0.6, 0.5] as const

/**
 * Controller tuning. The wide deadband + long cooldown + sustained-fast
 * requirement prevent ping-ponging between levels near a threshold, and the
 * warmup ignores load-time frame spikes. Every level change reallocates the
 * WebGL render targets; the renderer masks those reallocations
 * (uFeedbackReset), so they stay invisible either way.
 */

/** Smoothed frame time (ms) above which we drop a level. */
const FRAME_BUDGET_MS = 18
/** Smoothed frame time (ms) below which we may recover a level. */
const RECOVER_THRESHOLD_MS = 12
/** EMA smoothing factor for the frame-time signal (slow = less twitchy). */
const EMA_ALPHA = 0.05
/** Frames to wait after a change before allowing another (hysteresis). */
const COOLDOWN_FRAMES = 60
/** Consecutive fast frames required before recovering a level. */
const RECOVER_FRAMES = 120
/** Ignore the first frames after load so page/GPU warm-up spikes don't scale. */
const WARMUP_FRAMES = 60

export class AdaptiveRenderScale {
  private level = 0
  private ema = FRAME_BUDGET_MS
  private cooldown = COOLDOWN_FRAMES
  private recoverFrames = 0
  private warmup = WARMUP_FRAMES

  constructor(private readonly enabled: boolean) {}

  private currentScale(): number {
    return this.enabled ? STEPS[this.level] : 1.0
  }

  /**
   * Feed one frame's wall-clock duration (ms). Returns the render scale the
   * renderer should use for subsequent frames. Always 1.0 when disabled.
   */
  report(frameMs: number): number {
    if (!this.enabled) return 1.0

    // Skip early frames (load transients) before taking any action.
    if (this.warmup > 0) {
      this.warmup -= 1
      return this.currentScale()
    }

    this.ema += EMA_ALPHA * (frameMs - this.ema)

    if (this.cooldown > 0) {
      this.cooldown -= 1
      return this.currentScale()
    }

    if (this.ema > FRAME_BUDGET_MS) {
      // Running slow: drop a level (if we can) and reset the signal.
      if (this.level < STEPS.length - 1) {
        this.level += 1
        this.cooldown = COOLDOWN_FRAMES
        this.ema = FRAME_BUDGET_MS
      }
      this.recoverFrames = 0
    } else if (this.ema < RECOVER_THRESHOLD_MS) {
      // Running fast: only recover after a sustained stretch of fast frames.
      this.recoverFrames += 1
      if (this.recoverFrames >= RECOVER_FRAMES && this.level > 0) {
        this.level -= 1
        this.cooldown = COOLDOWN_FRAMES
        this.ema = FRAME_BUDGET_MS
        this.recoverFrames = 0
      }
    } else {
      this.recoverFrames = 0
    }

    return this.currentScale()
  }
}
