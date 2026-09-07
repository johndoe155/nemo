export interface SignoffHorizonGeometry {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  seam: number;
}

/** Read the RESOLVED pseudo-element height, not parseFloat('--bh-seam'):
 * the token is a clamp() expression. The anchor is the seam's actual lower
 * edge in sign-off coordinates, clamped to its top when padding exceeds it.
 * This deliberately does not attempt to reproject the cinematic 3D camera. */
export function measureSignoffHorizon(
  signoff: HTMLElement,
  frame: HTMLElement,
): SignoffHorizonGeometry | null {
  const box = signoff.getBoundingClientRect();
  const seam = parseFloat(getComputedStyle(frame, '::after').height);
  if (!box.width || !box.height || !Number.isFinite(seam) || seam <= 0) return null;
  if (window.innerHeight <= seam * 2) return null;
  return {
    width: box.width,
    height: box.height,
    anchorX: box.width / 2,
    anchorY: Math.min(box.height, Math.max(0, frame.getBoundingClientRect().bottom + seam - box.top)),
    seam,
  };
}
