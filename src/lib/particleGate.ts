/* ---------------------------------------------------------------------------
   particleGate — the boot gate for the hero's WebGL particle field.

   The field used to carry its OWN loading overlay (brand + spinner + status
   line, styles/nemo-particles.css). While the boot sequence owned the screen
   that overlay was hidden, but the moment `.is-booting` was removed it came
   BACK — so on a cold cache or a slow connection the reader watched a second
   loader paint across the hero behind the one they had just sat through. Two
   loaders for one page is the bug: the boot is the boot experience.

   The overlay is gone. What replaces it is this gate — the same shape as
   lib/fonts.ts, which is the precedent for "the boot loader does not release
   until X is ready, capped": the field reports when it has settled, and the
   loader awaits that before revealing the page. So the particles are already
   painted on the frame the hero appears, and removing the overlay costs
   nothing visually.

   Contract:
     · `settleParticleField()` is called ONCE by the field for every terminal
       state — ready, error, unsupported. A field that cannot draw must
       release the boot immediately; waiting out the cap for a renderer that
       does not exist would be pure latency.
     · `particleFieldReady(cap)` never rejects and never hangs: it races the
       settle against a cap, mirroring criticalFontsReady's Promise.race.
     · Registration order does not matter. React runs sibling effects in mount
       order — the loader's before the hero's — so the loader usually asks
       before the field exists; the promise simply stays pending until the
       field reports.
--------------------------------------------------------------------------- */

let settle: (() => void) | null = null;
let settled = false;

const gate = new Promise<void>((resolve) => {
  settle = resolve;
});

/** Called by the particle field once it has reached a terminal state. */
export function settleParticleField(): void {
  if (settled) return;
  settled = true;
  settle?.();
  settle = null;
}

/** True once the field has reported — exported for tests/diagnostics. */
export function particleFieldSettled(): boolean {
  return settled;
}

/** Resolves when the field settles, or when `capMs` says not to wait. Never
 *  rejects, never hangs. */
export function particleFieldReady(capMs = 1200): Promise<void> {
  if (settled) return Promise.resolve();
  return Promise.race([gate, after(capMs)]);
}

/** The ambient timer, whichever host provides it: the browser through
 *  `window`, the unit tests through the global. */
function after(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined') window.setTimeout(() => resolve(), ms);
    else setTimeout(() => resolve(), ms);
  });
}
