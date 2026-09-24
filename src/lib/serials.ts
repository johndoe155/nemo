/* ============================================================================
   serials — the edition voice (IDENTITY-SPEC §5, §6.1)

   The reference artwork's "#9584 WANTED" plate is the collection's own
   numbering language, and Space Grotesk is the face it is set in. Every place
   the site prints an edition number goes through here, so the format cannot
   drift between the registry, the stamp book, the storefront and the credits.
============================================================================ */

/**
 * "U-009" → "№ 009". Falls back to the raw string for anything that doesn't
 * carry a numeric tail (secret/redacted plates keep whatever they were given).
 */
export function plateSerial(code: string): string {
  const m = code.match(/(\d+)\s*$/);
  if (!m) return code;
  return `№ ${m[1].padStart(3, '0')}`;
}

/** The bare number, for tamper-proof-ish display in tight spots. */
export function serialDigits(code: string): string {
  const m = code.match(/(\d+)\s*$/);
  return m ? m[1].padStart(3, '0') : code;
}

/** Monotonic run number down a list — used for plate positions, not identity. */
export function runNumber(index: number, total: number): string {
  const width = String(total).length;
  return `${String(index + 1).padStart(width, '0')} / ${String(total).padStart(width, '0')}`;
}
