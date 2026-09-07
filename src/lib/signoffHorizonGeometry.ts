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
 * This deliberately does not attempt to reproject the cinematic 3D camera.
 *
 * `flowTop` is the sign-off's in-flow viewport top while a ScrollTrigger pin
 * holds it `position: fixed` (the pinned rect's top is the frozen pin
 * position, not the layout position — GSAP's pin-spacer owns the flow box).
 * When omitted, the element's own rect is used. Width/height always come off
 * the element itself: they drive the post-capture reflow retirement and must
 * stay the real rendered size even while pinned. */
export function measureSignoffHorizon(
  signoff: HTMLElement,
  frame: HTMLElement,
  flowTop?: number,
): SignoffHorizonGeometry | null {
  const box = signoff.getBoundingClientRect();
  const seam = parseFloat(getComputedStyle(frame, '::after').height);
  if (!box.width || !box.height || !Number.isFinite(seam) || seam <= 0) return null;
  if (window.innerHeight <= seam * 2) return null;
  const top = flowTop ?? box.top;
  return {
    width: box.width,
    height: box.height,
    anchorX: box.width / 2,
    anchorY: Math.min(box.height, Math.max(0, frame.getBoundingClientRect().bottom + seam - top)),
    seam,
  };
}
