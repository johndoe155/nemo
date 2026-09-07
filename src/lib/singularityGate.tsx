import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

export type BlackHoleStageStatus = 'booting' | 'live' | 'unsupported' | 'error';

// One breakpoint for both consumers. This is Singularity's original,
// synchronous first-paint matchMedia policy, lifted rather than re-invented.
const MOBILE_QUERY = '(max-width: 768px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

function useMediaQuery(query: string): boolean {
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
  canWarpSignoff: boolean;
  frameRef: RefObject<HTMLDivElement>;
  reportStatus: (status: BlackHoleStageStatus) => void;
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
  const value = useMemo(
    () => ({
      isMobile,
      canWarpSignoff: !isMobile && !reduced && status === 'live',
      frameRef,
      reportStatus,
    }),
    [isMobile, reduced, status],
  );

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useSingularityGate(): SingularityGate {
  const gate = useContext(GateContext);
  if (!gate) throw new Error('The singularity and sign-off need SingularityProvider.');
  return gate;
}
