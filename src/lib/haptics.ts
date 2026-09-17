/* ---------------------------------------------------------------------------
   haptics — the missing physical channel (DESIGN_AUDIT P4.16 / 3.5).

   On coarse pointers the cursor glow, the magnets and the tick sounds are
   all absent or unheard; the one feedback channel left is the vibration
   motor. One util, four call sites, exactly the audit's pattern table —
   feature-detected via `navigator.vibrate` presence, which is the honest
   gate: iOS reports no vibrate, so it stays silent rather than pretending.
--------------------------------------------------------------------------- */

export type HapticPattern = number | number[];

/** Fire a pattern. Returns whether the device accepted it (tests + callers
 *  never branch on the result; it exists for the unit suite). */
export function haptic(pattern: HapticPattern): boolean {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      return navigator.vibrate(pattern);
    }
  } catch {
    /* hostile / missing implementation — silence is the contract */
  }
  return false;
}

/** The audit's table, verbatim, in one place so tuning stays out of
 *  components (same discipline as the SOUND registry). */
export const HAPTIC = {
  /** a stamp resolves into the ledger */
  stamp: 8,
  /** legendary / secret reveal — the syncopated casino rhythm */
  reveal: [4, 24, 10],
  /** a dialog opens (roster card, rotunda plate) */
  dialogOpen: 6,
} as const;
