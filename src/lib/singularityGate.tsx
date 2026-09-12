import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';

export type BlackHoleStageStatus = 'booting' | 'live' | 'unsupported' | 'error';

// One breakpoint for both consumers. This is Singularity's original,
// synchronous first-paint matchMedia policy, lifted rather than re-invented.
const MOBILE_QUERY = '(max-width: 768px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

interface SingularityGate {
  isMobile: boolean;
  /** Whether the sign-off may be held and consumed at all: the LAYOUT half of the
   * scene — the hold, the fall, the collapse. It deliberately does NOT ask about
   * the GPU. Every previous attempt gated the pin on the stage's status, so on a
   * browser where WebGPU and WebGL2 both stay out (Safari before 18, Firefox,
   * a cross-origin frame, a GPU blocklist, a stalled `renderer.init()`) the
   * section was not merely un-warped, it was un-pinned: the composition never
   * locked at all. Locking a box to the viewport is a layout fact; it is now
   * gated on layout, and on layout only. */
  canHoldSignoff: boolean;
  /** Whether the sign-off may also be captured into the frozen frame and warped by
   * WebGL2 — the paint half, which genuinely does need a GPU. `false` costs the
   * reader the overlay, never the hold: the live flyers cross the horizon on their
   * own geometry (see `overlayMixAt`). */
  canWarpSignoff: boolean;
  frameRef: RefObject<HTMLDivElement>;
  /** `.bh-hold`, the element the hold's reservation is spent on: the empty box
   * immediately ABOVE the singularity section. `SignoffHorizon` grows it one pixel
   * per scrolled pixel for the span of the hold, which is what keeps the black
   * hole and the sign-off rigidly locked to the viewport together — see
   * `holdDistanceAt` in lib/spaghettification.ts. It lives with the section (not
   * with the footer) because it has to sit above the composition, and it is handed
   * across here for the same reason `frameRef` is. */
  holdRef: RefObject<HTMLDivElement>;
  /** The consumption playhead and whether the hold is engaged, written by
   * `SignoffHorizon` and read per frame by `BlackHoleStage` to drive the
   * simulation's physical response (mass / lensing / Doppler / disk rotation).
   * A ref rather than state on purpose: the render loop reads it once per frame
   * and nothing anywhere needs to re-render because of it. Only the hold's OWN
   * clock (`p`) feeds it — see `consumptionResponseAt` in
   * lib/spaghettification.ts, which turns this into the uniform excursions. */
  consumptionRef: MutableRefObject<{ active: boolean; progress: number }>;
  reportStatus: (status: BlackHoleStageStatus) => void;
  /** True for exactly as long as the hold is keeping the screen locked. The black
   * hole has to be rigidly static while the invitation falls into it, and "static"
   * is not only a scroll question: the reservation holds the container's box, but
   * the stage's own cinematic camera would still fly the disc around inside it.
   * `BlackHoleStage` therefore holds the camera — not the simulation, which stays
   * live — for as long as this is set.
   *
   * A ref rather than state on purpose: the render loop reads it once per frame
   * and nothing anywhere needs to re-render because of it. */
  cameraHoldRef: MutableRefObject<boolean>;
}

const GateContext = createContext<SingularityGate | null>(null);

/** No DOM wrapper: <main>, the sign-off and the curtain keep their layout and
 * stacking contexts. Status is reported by BlackHoleStage's own state machine,
 * never inferred from navigator.gpu or the presence of a canvas/still. */
export function SingularityProvider({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const [status, reportStatus] = useState<BlackHoleStageStatus>('booting');
  const frameRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const cameraHoldRef = useRef(false);
  const consumptionRef = useRef({ active: false, progress: 0 });
  const canHoldSignoff = !isMobile && !reduced;
  const value = useMemo(
    () => ({
      isMobile,
      canHoldSignoff,
      // Only the frozen-frame overlay asks the stage whether it is alive.
      canWarpSignoff: canHoldSignoff && status === 'live',
      frameRef,
      holdRef,
      consumptionRef,
      reportStatus,
      cameraHoldRef,
    }),
    [isMobile, canHoldSignoff, status],
  );

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useSingularityGate(): SingularityGate {
  const gate = useContext(GateContext);
  if (!gate) throw new Error('The singularity and sign-off need SingularityProvider.');
  return gate;
}
