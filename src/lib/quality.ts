/* ============================================================================
   quality — the device tier the whole page agrees on.

   Before the overhaul, every subsystem guessed at its own budget: the
   ambience shader stepped its own resolution down, the persona model had its
   own breakpoint, the rotunda had its own mount margin, the particle field
   had its own gate. Four guesses, four chances to disagree — a phone could
   pass the particle gate and still be handed a full-density field.

   One tier is measured once (per breakpoint change) and published. Tiers:

     high     desktop, fine pointer, no motion preference — everything on
     balanced mid-range / high-DPR phones / integrated GPUs — reduced counts
     low      coarse pointer or small viewport — CSS ambience, static
              particles, flat gallery, no model preload
     reduced  prefers-reduced-motion — no continuous loops anywhere

   `reduced` is deliberately a TIER and not a separate boolean: a reduced-
   motion visitor on a workstation should get the whole authored composition
   (full-quality static frames, real typography, real art) with the time
   dimension removed — not the mobile degradation path.
   ========================================================================== */

export type QualityTier = 'high' | 'balanced' | 'low' | 'reduced';

export interface QualityProfile {
  tier: QualityTier;
  /** Ambient WebGL shader allowed at all (false ⇒ CSS wash). */
  ambientShader: boolean;
  /** Hero particle field budget, 0..1 (0 ⇒ static single frame). */
  particleDensity: number;
  /** DPR cap for WebGL layers. */
  dprCap: number;
  /** Persona 3D model may mount. */
  personaModel: boolean;
  /** Rotunda sphere may mount (false ⇒ flat plate list). */
  rotundaSphere: boolean;
  /** Black hole live simulation may run (false ⇒ authored still). */
  liveSingularity: boolean;
  /** Custom cursor with springs + magnetic pull. */
  liveCursor: boolean;
  /** Cinematic scrubbed transitions (GSAP timelines) vs. plain opacity. */
  cinematicTransitions: boolean;
  /** Ambient breathing loops (CSS keyframes on decoration). */
  ambientLoops: boolean;
  /** Backdrop-filter glass allowed (expensive on low-end mobile). */
  glass: boolean;
}

const PROFILES: Record<QualityTier, Omit<QualityProfile, 'tier'>> = {
  high: {
    ambientShader: true,
    particleDensity: 1,
    dprCap: 1.75,
    personaModel: true,
    rotundaSphere: true,
    liveSingularity: true,
    liveCursor: true,
    cinematicTransitions: true,
    ambientLoops: true,
    glass: true,
  },
  balanced: {
    ambientShader: true,
    particleDensity: 0.6,
    dprCap: 1.25,
    personaModel: true,
    rotundaSphere: true,
    liveSingularity: true,
    liveCursor: true,
    cinematicTransitions: true,
    ambientLoops: true,
    glass: true,
  },
  low: {
    ambientShader: false,
    particleDensity: 0.22,
    dprCap: 1,
    personaModel: false,
    rotundaSphere: false,
    liveSingularity: false,
    liveCursor: false,
    cinematicTransitions: false,
    ambientLoops: false,
    glass: false,
  },
  reduced: {
    ambientShader: true, // a STATIC frame is the authored composition
    particleDensity: 0,
    dprCap: 1.5,
    personaModel: false,
    rotundaSphere: false,
    liveSingularity: false,
    liveCursor: false,
    cinematicTransitions: false,
    ambientLoops: false,
    glass: true,
  },
};

export function profileFor(tier: QualityTier): QualityProfile {
  return { tier, ...PROFILES[tier] };
}

/* ---------------------------------------------------------------------------
   detectTier — synchronous feature/device sniff, safe on first paint.

   Signals, in order of authority:
     1. prefers-reduced-motion   → 'reduced' (never overridden; it is a
                                   stated preference, not a capability)
     2. coarse pointer OR ≤768px → 'low'
     3. hardwareConcurrency ≤ 4 OR deviceMemory ≤ 4 OR DPR ≥ 2.5 on a small
        screen                   → 'balanced'
     4. otherwise                → 'high'
--------------------------------------------------------------------------- */

export function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'balanced';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if (window.matchMedia('(pointer: coarse)').matches) return 'low';
  if (window.matchMedia('(max-width: 768px)').matches) return 'low';

  const nav = navigator as Navigator & {
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const dpr = window.devicePixelRatio || 1;

  if (cores <= 4 || mem <= 4) return 'balanced';
  if (dpr >= 2.5 && window.innerWidth < 1440) return 'balanced';
  return 'high';
}

/** True when the browser can paint backdrop-filter at all. */
export function supportsGlass(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    CSS.supports('backdrop-filter', 'blur(6px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(6px)')
  );
}

/** Constrain a WebGL render scale by the tier's DPR cap. */
export function dprFor(tier: QualityTier): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(dpr, profileFor(tier).dprCap);
}
