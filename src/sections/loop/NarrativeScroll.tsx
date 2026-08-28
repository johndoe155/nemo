/* ============================================================================
   NarrativeScroll — the flywheel copy, re-timed as a scroll-tied sequence.

   The old subheading crammed seven phases into one paragraph of inline arrows.
   Here each phase owns a slice of the pinned track: as the user scrolls, the
   active phrase is illuminated while the ones already travelled through dim
   and the ones ahead wait in the dark — the copy can only be consumed in
   order, at the pace of the wheel.

   Pinned (desktop): the phrases overlap inside the sticky frame and are driven
   by the track's scroll progress.
   Unpinned (mobile / short viewports): the phrases stack vertically and are
   driven by whichever one is nearest the reading line.

   All state is written straight to DOM refs — no React re-render per frame.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

export interface NarrativePhrase {
  n: string;
  text: string;
}

interface Props {
  phrases: NarrativePhrase[];
  trackRef: React.RefObject<HTMLElement | null>;
  pinned: boolean;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function NarrativeScroll({ phrases, trackRef, pinned: pinnedProp }: Props) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  const wide = useMediaQuery('(min-width: 900px)');
  const tall = useMediaQuery('(min-height: 620px)');
  const pinned = pinnedProp && wide && tall;

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const n = phrases.length;
      if (!n) return;

      let p = 0;
      if (pinned) {
        const track = trackRef.current;
        if (track) {
          const rect = track.getBoundingClientRect();
          const span = Math.max(1, rect.height - window.innerHeight);
          p = clamp(-rect.top / span, 0, 1);
        }
      } else {
        const list = listRef.current;
        if (list) {
          const rect = list.getBoundingClientRect();
          const line = window.innerHeight * 0.58;
          p = clamp((line - rect.top) / Math.max(1, rect.height), 0, 1);
        }
      }

      /* Pinned: the band centres are walked end to end, so the first phase is
         already lit when the track starts and the last one is still lit when
         it ends. Stacked: the cursor simply tracks the reading line. */
      const cursor = pinned ? p * (n - 1) + 0.5 : p * n;

      for (let i = 0; i < n; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const local = cursor - i;

        /* Each phrase owns a band of the track: it climbs from just before
           its band opens, holds through the middle, then falls away to a
           faint echo. The rise and the fall overlap deliberately, so the
           copy crossfades instead of dipping to black between phases. */
        const rise = clamp((local + 0.35) / 0.5, 0, 1);
        const fall = 1 - clamp((local - 0.62) / 0.34, 0, 1) * 0.94;
        const w = local < -0.35 ? 0 : clamp(rise * fall, 0, 1);

        /* stacked phrases keep more of their ink — the dimming only has to
           establish an order, not hide the sentence */
        const opacity = pinned ? 0.09 + 0.91 * w : 0.16 + 0.84 * w;
        const blur = (1 - w) * (pinned ? 7 : 4);
        const y = clamp(0.5 - local, -0.9, 0.9) * (pinned ? 40 : 0) - (1 - w) * 4;
        const scale = 0.975 + 0.025 * w;

        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
        el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;

        const state = w > 0.55 ? 'active' : local > 0.5 ? 'past' : 'future';
        if (el.dataset.state !== state) el.dataset.state = state;

        const bar = barRefs.current[i];
        if (bar) {
          bar.style.transform = `scaleX(${clamp(local, 0, 1).toFixed(3)})`;
        }
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [phrases.length, pinned, trackRef]);

  return (
    <div className="loop__narrative" data-pinned={pinned}>
      <ul className="loop__phrases" ref={listRef}>
        {phrases.map((ph, i) => (
          <li
            className="loop__phrase"
            key={ph.n}
            data-state="future"
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
          >
            <span className="loop__phrase-n" aria-hidden="true">
              {ph.n}
            </span>
            <span className="loop__phrase-text">{ph.text}</span>
          </li>
        ))}
      </ul>

      <div className="loop__rail" aria-hidden="true">
        {phrases.map((ph, i) => (
          <span className="loop__rail-seg" key={ph.n}>
            <i
              ref={(el) => {
                barRefs.current[i] = el;
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
