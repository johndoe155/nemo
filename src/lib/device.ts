/**
 * Device detection + DPR strategy. Mobile/touch render DPR is capped at
 * MOBILE_DPR_CAP (fill-rate protection); desktop uses native DPR uncapped.
 */

/** Drawing-buffer pixel-ratio ceiling for mobile/touch devices. */
export const MOBILE_DPR_CAP = 1.5

/** Mobile/touch detection: coarse pointer + touch, or a mobile UA string. */
export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const touchCapable = (navigator.maxTouchPoints ?? 0) > 0
  const uaMobile = /android|iphone|ipad|ipod|mobile|harmonyos|miui/i.test(navigator.userAgent)

  return Boolean((coarsePointer && touchCapable) || uaMobile)
}

/**
/** Mobile: min(native, cap); desktop: native. Floored at 1. */
export function getTargetDevicePixelRatio(isMobile: boolean = detectMobileDevice()): number {
  const native = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  if (isMobile) {
    return Math.max(1, Math.min(native, MOBILE_DPR_CAP))
  }
  return Math.max(1, native)
}
