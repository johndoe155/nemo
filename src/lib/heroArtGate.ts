/* ---------------------------------------------------------------------------
   heroArtGate — the boot gate for the hero's key art (ONE TAKE).

   The hero is now the POSTER: one full-bleed key art instead of the WebGL
   particle field. The boot loader holds the page until that image has
   decoded, so the frame the loader releases is the frame the poster is
   painted — the same contract shape as lib/fonts.ts and the retired
   lib/particleGate.ts (which the poster superseded): settle once, race a
   cap, never reject, never hang.
--------------------------------------------------------------------------- */

let settle: (() => void) | null = null;
let settled = false;

const gate = new Promise<void>((resolve) => {
  settle = resolve;
});

/** Called by the hero once its key art has decoded (or failed to). */
export function settleHeroArt(): void {
  if (settled) return;
  settled = true;
  settle?.();
  settle = null;
}

/** True once the art has reported — exported for tests/diagnostics. */
export function heroArtSettled(): boolean {
  return settled;
}

/** Resolves when the art decodes, or when `capMs` says not to wait. */
export function heroArtReady(capMs = 2600): Promise<void> {
  if (settled) return Promise.resolve();
  return Promise.race([gate, after(capMs)]);
}

function after(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined') window.setTimeout(() => resolve(), ms);
    else setTimeout(() => resolve(), ms);
  });
}
