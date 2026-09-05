/* ---------------------------------------------------------------------------
   sound — tasteful WebAudio feedback (DESIGN_AUDIT P2.5). Two synthesized
   blips: a soft "attract" tick on hover and a brighter "confirm" tick on
   click. Fully lazy: the AudioContext is only created after the user
   explicitly enables sound via the SOUND toggle.
--------------------------------------------------------------------------- */

let ctx: AudioContext | null = null;

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

function blip(freq: number, duration: number, peak: number, type: OscillatorType) {
  const ac = ensureContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(peak, ac.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

/** Soft high tick when the cursor lands on an interactive target. */
export function attractTick() {
  blip(1240, 0.05, 0.02, 'sine');
}

/** Brighter, lower confirmation on click / activation. */
export function confirmTick() {
  blip(660, 0.12, 0.045, 'triangle');
}
