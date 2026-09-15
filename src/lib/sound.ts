/* ---------------------------------------------------------------------------
   sound — the diegetic interface audio (DESIGN_AUDIT P2.5 → P4.15).

   v1 was two synthesized blips behind the SOUND toggle. v2 keeps everything
   that made it tasteful — lazy AudioContext (created only after the user
   explicitly enables sound), synthesized sources, zero assets — and grows it
   into the audit's map: a metal-gravity-ink register with every voice's
   tuning in the SOUND table below, so no component ever passes a frequency.

   Registry (per audit 3.4):
     attract / confirm   the original ticks (unchanged numbers, unchanged feel)
     rodRing             short filtered-noise burst on the roster rail while
                         dragging — frequency maps to |carriage velocity|, the
                         same value HangingCard's pendulums consume
     gravity             40–60 Hz sine bed under the Singularity district;
                         gain = f(distance to the section rect), updated at
                         10 Hz off the scroll channel (never per-frame), and
                         fully stopped — not muted — outside its range
     stampThud / whoosh  the pull's phase transitions, fired from the engine
                         BEFORE the reveal frame for anticipation
     nearMiss            rising glissando for the casino cue (the RNG landed
                         secret/legendary one pull before pity)

   Everything is a no-op until `setSoundEnabled(true)`; the context is only
   ever created inside a user gesture, so autoplay policy is never grazed.
--------------------------------------------------------------------------- */

export interface BlipSpec {
  freq: number;
  dur: number;
  peak: number;
  type: OscillatorType;
}
export interface SweepSpec {
  /** starting frequency (Hz) */
  from: number;
  to: number;
  dur: number;
  peak: number;
  filter: BiquadFilterType;
  q: number;
}
export interface RingSpec {
  /** frequency at speed 0 … */
  base: number;
  /** … plus this many Hz per px/ms of carriage speed, capped at `max`. */
  perUnit: number;
  max: number;
  dur: number;
  peak: number;
  q: number;
}

export const SOUND = {
  attract: { freq: 1240, dur: 0.05, peak: 0.02, type: 'sine' } satisfies BlipSpec,
  confirm: { freq: 660, dur: 0.12, peak: 0.045, type: 'triangle' } satisfies BlipSpec,
  rodRing: { base: 820, perUnit: 2400, max: 3600, dur: 0.16, peak: 0.05, q: 7 } satisfies RingSpec,
  stampThud: { freq: 92, dur: 0.22, peak: 0.09, type: 'sine' } satisfies BlipSpec,
  whoosh: { from: 220, to: 1500, dur: 0.62, peak: 0.03, filter: 'bandpass', q: 0.9 } satisfies SweepSpec,
  nearMiss: { from: 300, to: 980, dur: 0.5, peak: 0.045, filter: 'lowpass', q: 3 } satisfies SweepSpec,
  /** the gravity bed: two detuned sines inside the audit's 40–60 Hz window,
      the small beat between them is the "hum of a held object". */
  gravity: { a: 52, b: 47.3, peak: 0.05, ramp: 0.4 } as const,
} as const;

let ctx: AudioContext | null = null;
let enabled = false;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(spec: BlipSpec, freqOverride?: number) {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = spec.type;
  osc.frequency.value = freqOverride ?? spec.freq;
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(spec.peak, ac.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + spec.dur);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + spec.dur + 0.02);
}

/* One short white-noise buffer, built on first use, reused by every filtered
   burst. 0.7 s covers the whoosh; bursts read a random slice of it. */
let noiseBuf: AudioBuffer | null = null;
function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.7), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseBurst(opts: {
  dur: number;
  peak: number;
  filter: BiquadFilterType;
  q: number;
  from: number;
  to?: number; // sweep end (defaults to `from` — a held filter)
}) {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const flt = ac.createBiquadFilter();
  flt.type = opts.filter;
  flt.Q.value = opts.q;
  flt.frequency.setValueAtTime(opts.from, ac.currentTime);
  if (opts.to !== undefined && opts.to !== opts.from) {
    flt.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), ac.currentTime + opts.dur);
  }
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(opts.peak, ac.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + opts.dur);
  src.connect(flt).connect(gain).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + opts.dur + 0.02);
}

/* --------------------------- public voices --------------------------- */

/** Soft high tick when the cursor lands on an interactive target. */
export function attractTick() {
  blip(SOUND.attract);
}

/** Brighter, lower confirmation on click / activation. */
export function confirmTick() {
  blip(SOUND.confirm);
}

/** Metal on metal: the rod ring under a card press while the rail is in
 *  motion. `speed` is |carriage velocity| in px/ms — the harder the yank,
 *  the higher the ring, exactly as the audit maps it. */
export function rodRing(speed: number) {
  const r = SOUND.rodRing;
  const freq = Math.min(r.max, r.base + Math.abs(speed) * r.perUnit);
  if (!enabled) return;
  noiseBurst({ dur: r.dur, peak: r.peak, filter: 'bandpass', q: r.q, from: freq });
}

/** The pull resolves: a low body with a bright transient on top (ink on a
 *  desk, not a drum kit). Fired at the phase transition, before the reveal
 *  frame paints, so the ear gets the event a beat early. */
export function stampThud() {
  blip(SOUND.stampThud);
  noiseBurst({ dur: 0.05, peak: 0.022, filter: 'highpass', q: 0.7, from: 1800 });
}

/** Anticipation: the reel spinning up, a bandpass swept open across its run. */
export function pullWhoosh() {
  const w = SOUND.whoosh;
  noiseBurst({ dur: w.dur, peak: w.peak, filter: w.filter, q: w.q, from: w.from, to: w.to });
}

/** The casino cue: a short rising glissando under the 2-frame hesitation. */
export function nearMissGliss() {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac) return;
  const n = SOUND.nearMiss;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(n.from, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(n.to, ac.currentTime + n.dur);
  const flt = ac.createBiquadFilter();
  flt.type = n.filter;
  flt.Q.value = n.q;
  flt.frequency.value = 1600;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(n.peak, ac.currentTime + 0.05);
  gain.gain.setValueAtTime(n.peak, ac.currentTime + n.dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + n.dur);
  osc.connect(flt).connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + n.dur + 0.02);
}

/* --------------------------- gravity bed ---------------------------
   Two detuned sines at the audit's 40–60 Hz, gain driven by distance to the
   #singularity section. Runs at 10 Hz on the scroll channel (never a rAF),
   and stops entirely — nodes disconnected, no listener — whenever the hole
   is beyond `FAR` viewport-heights of centre, so off-district the cost is
   exactly zero. ---------------------------------------------------------------- */
const FAR_VH = 1.1; // how far (viewport heights) the bed still reaches
const TICK_MS = 100; // 10 Hz, per the audit

interface GravityBed {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  gain: GainNode;
  timer: number;
  onScroll: () => void;
}
let bed: GravityBed | null = null;

function bedTarget(): number {
  const section = document.getElementById('singularity');
  if (!section) return 0;
  const r = section.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const center = r.top + r.height / 2;
  const dist = Math.abs(center - vh / 2) / vh;
  const near = Math.max(0, 1 - Math.max(0, dist - 0.5) / (FAR_VH - 0.5));
  return near * SOUND.gravity.peak;
}

function startBed() {
  const ac = ctx;
  if (!ac || bed) return;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);
  const oscA = ac.createOscillator();
  const oscB = ac.createOscillator();
  oscA.type = oscB.type = 'sine';
  oscA.frequency.value = SOUND.gravity.a;
  oscB.frequency.value = SOUND.gravity.b;
  oscA.connect(gain);
  oscB.connect(gain);
  oscA.start();
  oscB.start();

  let last = 0;
  const tick = () => {
    const t = bedTarget();
    if (t <= 0.0005 && gain.gain.value <= 0.0005 && performance.now() - last > TICK_MS) {
      stopBed(); // zero cost off-axis: fully stopped, a cheap watcher re-arms
      return;
    }
    if (bed) {
      last = performance.now();
      gain.gain.setTargetAtTime(t, ac.currentTime, SOUND.gravity.ramp);
    }
  };
  /* 10 Hz updates ride the SCROLL AUTHORITY's cadence (lib/scroll emits on
     Lenis 'scroll'); the 1 s heartbeat is only a safety net for section
     growth/refresh with no scroll in between — distance only changes
     under scroll, resize, or layout. */
  const offScroll = onSoundScrollTick(tick);
  bed = { oscA, oscB, gain, timer: window.setInterval(tick, 1000), onScroll: offScroll };
  tick();
}

let bedWatcher: (() => void) | null = null;

function armBedWatcher() {
  /* A stopped bed is not a dead channel: one throttled scroll tick watches
     for the reader coming BACK to the district (the audit's swell is a
     proximity effect, both directions). The tick starts the bed and
     unsubscribes itself — still zero-cost while idle. */
  if (bedWatcher || !enabled) return;
  let last = 0;
  const fn = () => {
    const now = performance.now();
    if (now - last < 400) return;
    last = now;
    if (bedTarget() > 0.0005) {
      bedWatcher?.();
      bedWatcher = null;
      startBed();
    }
  };
  const off = onSoundScrollTick(fn);
  bedWatcher = () => off();
}

function stopBed() {
  if (!bed) return;
  const { oscA, oscB, gain, timer, onScroll } = bed;
  bed = null;
  window.clearInterval(timer);
  onScroll();
  armBedWatcher();
  try {
    gain.gain.setTargetAtTime(0, ctx ? ctx.currentTime : 0, 0.12);
  } catch {
    /* already detached */
  }
  window.setTimeout(() => {
    try {
      oscA.stop();
      oscB.stop();
      gain.disconnect();
    } catch {
      /* teardown races are fine */
    }
  }, 500);
}

/* --------------------------- enablement --------------------------- */

/** The single switch. SoundToggle owns the UI; everything else here just
 *  waits to be allowed. Two entry shapes: the toggle's CLICK (a user
 *  gesture — the context may be created and started right away) and the
 *  mount-time re-read of the stored preference (no gesture — the context is
 *  created suspended and the bed unlocks on the first real pointerdown, so
 *  the autoplay policy is respected by construction, never by luck). */
let pendingBed = false;
const unlock = () => {
  if (!enabled) return;
  ensureContext(); // resume attempt inside the gesture
  if (ctx && ctx.state === 'running' && pendingBed) {
    pendingBed = false;
    startBed();
  }
};

export function setSoundEnabled(next: boolean) {
  enabled = next;
  if (next) {
    ensureContext();
    if (ctx && ctx.state === 'running') {
      startBed();
    } else {
      pendingBed = true;
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  } else {
    pendingBed = false;
    window.removeEventListener('pointerdown', unlock);
    if (bedWatcher) {
      bedWatcher();
      bedWatcher = null;
    }
    stopBed();
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/* Scroll-channel bridge (the audit's "updated from the Lenis/scroll channel"):
   lib/scroll emits on every Lenis scroll; consumers throttle themselves.
   The wire lives HERE, not in the engine — lib/scroll must never learn that
   audio exists (it calls emitScrollTick through a registered sink). */
const scrollHandlers = new Set<() => void>();
export function onSoundScrollTick(fn: () => void): () => void {
  scrollHandlers.add(fn);
  return () => scrollHandlers.delete(fn);
}
/** lib/scroll.ts calls this from its Lenis 'scroll' handler. */
export function emitScrollTick(): void {
  for (const fn of scrollHandlers) fn();
}
