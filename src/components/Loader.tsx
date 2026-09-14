import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

import { LOGO_SRC } from '../lib/assets';
import {
  CHAR_MORPH_D,
  COUNTER,
  DIGIT_MORPH_D,
  MORPH_PAIRING,
  VIEWBOX,
} from '../lib/nemoLoaderData';
import { GLYPH_SCALE, counterLabel, glyphPath, layoutCounter, trackingAt } from '../lib/nemoMorph';

gsap.registerPlugin(MorphSVGPlugin);

/* ---------------------------------------------------------------------------
   THE LOADER — "the typographic morph".

   A massive, desaturated percentage counter counts 0 → 100 dead centre while
   its tracking tightens from 0.19em down to 0.012em — the climb contracts.
   At 100% the numerals are handed to MorphSVG and snap into the character's
   vector paths under expo.inOut, and the ink adopts the holographic gradient
   in the same frame.

   Everything here is one coordinate system: the counter is drawn from the
   actual PP Neue Machina outlines (extracted at build time, so there is no
   webfont dependency at boot), laid out by the same formula the generator used
   to bake the morph's opening frame — see src/lib/nemoMorph.ts. That is what
   makes the handoff invisible: at 100% the counter *is* DIGIT_MORPH_D's
   numerals, so swapping the live glyphs for the baked path costs nothing and
   the tween simply continues from there.

   gsap reads shapeIndices[i] per subpath: a scalar 0 only covers subpath 0 and
   every other subpath falls back to "auto" rotational matching, which slides
   the authored anchors onto other anchors of the same contour and destroys the
   generator's piece-for-piece pairing. One zero per piece pins them all.
--------------------------------------------------------------------------- */

const NO_ROTATION = new Array<number>(MORPH_PAIRING.pieces).fill(0);

const DIGIT_SLOTS = 3; // the counter never needs more than three
const COUNT_S = 2.15; // 0 → 100
const PRE_SNAP_S = 0.16; // the beat at 100% before the snap
const SNAP_S = 0.82; // the morph itself
const LAND_HOLD_S = 1.6; // the character, alone and settled, before the page is revealed

type DigitRef = SVGGElement | null;

export default function Loader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<SVGGElement>(null);
  const morphRef = useRef<SVGPathElement>(null);
  const exactRef = useRef<SVGGElement>(null);
  const pctRef = useRef<SVGGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const digitRefs = useRef<DigitRef[]>([]);
  const digitPaths = useRef<(SVGPathElement | null)[]>([]);

  const landedRef = useRef(false);
  const reducedRef = useRef(false);

  const [exactArt, setExactArt] = useState<string[] | null>(null);
  const [gone, setGone] = useState(false);

  const initialLabel = counterLabel(0);
  const initialFrame = layoutCounter(initialLabel, trackingAt(0));

  /* The exact artwork — 3,823 cubics — is fetched while the counter climbs and
     only ever fades in after the character lands, so the morph runs on the
     1,279-cubic fitted target and the dust resolves at the end. */
  useEffect(() => {
    let cancelled = false;
    fetch(LOGO_SRC)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((text) => {
        if (cancelled) return;
        const ds = [...text.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
        if (ds.length) setExactArt(ds);
      })
      .catch(() => {
        /* no exact art: the fitted target stands on its own */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Crossfade the exact art over the fitted target, whichever arrives last. */
  const resolveExact = useCallback(() => {
    landedRef.current = true;
    const exact = exactRef.current;
    const morph = morphRef.current;
    if (!exact) return;
    if (reducedRef.current) {
      gsap.set(exact, { autoAlpha: 1 });
      if (morph) gsap.set(morph, { autoAlpha: 0 });
      return;
    }
    gsap.to(exact, { autoAlpha: 1, duration: 0.34, ease: 'power2.out' });
    if (morph) gsap.to(morph, { autoAlpha: 0, duration: 0.34, ease: 'power2.out' });
  }, []);

  useEffect(() => {
    if (exactArt && landedRef.current) resolveExact();
  }, [exactArt, resolveExact]);

  useEffect(() => {
    const root = rootRef.current;
    const morph = morphRef.current;
    if (!root || !morph) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reducedRef.current = reduced;

    const html = document.documentElement;
    html.classList.add('is-booting');

    /* The page must not scroll out from under the loader. Blocking the two
       gesture streams keeps the scroll position (and every ScrollTrigger
       measuring from it) untouched — unlike an overflow lock, which would
       clamp a restored scroll position on reload. */
    const blockScroll = (event: Event) => event.preventDefault();
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      html.classList.remove('is-booting');
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
      setGone(true);
    };

    const slots = digitRefs.current;
    const paths = digitPaths.current;

    /** One counter frame: numbers, tracking, block centring. */
    const render = (progress: number) => {
      const label = counterLabel(progress);
      const frame = layoutCounter(label, trackingAt(progress));
      for (let i = 0; i < DIGIT_SLOTS; i++) {
        const slot = slots[i];
        const path = paths[i];
        if (!slot || !path) continue;
        const ch = label[i];
        slot.style.opacity = ch ? '1' : '0';
        if (!ch) continue;
        if (path.dataset.ch !== ch) {
          path.setAttribute('d', glyphPath(ch));
          path.dataset.ch = ch;
        }
        slot.setAttribute(
          'transform',
          `translate(${frame.origins[i]} ${COUNTER.baseline}) scale(${GLYPH_SCALE})`,
        );
      }
      if (pctRef.current) {
        pctRef.current.setAttribute(
          'transform',
          `translate(${frame.pctX} ${COUNTER.pctY}) scale(${COUNTER.pctScale})`,
        );
      }
    };

    /* The ignition: the numerals are already the morph's opening frame, so the
       swap is invisible, and the ink adopts the holographic gradient in the
       same frame the tween starts. autoAlpha 0 took *visibility* with it when
       the path was hidden, so it must be handed back as a pair — a bare
       opacity write would leave the morph tweening invisibly and only the
       late exact-art crossfade would ever show the character. */
    const ignite = () => {
      morph.classList.add('is-holo');
      for (let i = 0; i < DIGIT_SLOTS; i++) {
        const slot = slots[i];
        if (slot) slot.style.opacity = '0';
      }
      gsap.set(morph, { autoAlpha: 1 });
    };

    /* StrictMode mounts this effect twice: every animated property is stated
       here, not only in JSX, so the second run starts from zero. */
    render(0);
    gsap.set(root, { autoAlpha: 1 });
    gsap.set(morph, { autoAlpha: 0, attr: { d: DIGIT_MORPH_D } });
    gsap.set(glowRef.current, { autoAlpha: 0, scale: 0.72 });
    gsap.set(pctRef.current, { autoAlpha: 1 });
    gsap.set(artRef.current, { scale: 1, transformOrigin: `${COUNTER.centerX}px ${COUNTER.centerY}px` });
    if (exactRef.current) gsap.set(exactRef.current, { autoAlpha: 0 });

    const tl = gsap.timeline();

    if (reduced) {
      /* No count, no morph, no snap: the character is simply there, and then
         the page is. */
      gsap.set(morph, { attr: { d: CHAR_MORPH_D }, autoAlpha: 1 });
      morph.classList.add('is-holo');
      for (let i = 0; i < DIGIT_SLOTS; i++) {
        const slot = slots[i];
        if (slot) slot.style.opacity = '0';
      }
      gsap.set(pctRef.current, { autoAlpha: 0 });
      gsap.set(glowRef.current, { autoAlpha: 0.26 });
      resolveExact();
      tl.to(root, { autoAlpha: 0, duration: 0.4, ease: 'power1.inOut', delay: 0.3, onComplete: finish });
    } else {
      const proxy = { p: 0 };
      tl.to(
        proxy,
        {
          p: 1,
          duration: COUNT_S,
          ease: 'power2.inOut',
          onUpdate: () => render(proxy.p),
        },
        0,
      )
        .addLabel('snap', `+=${PRE_SNAP_S}`)
        .to(pctRef.current, { autoAlpha: 0, scale: 0.82, duration: 0.24, ease: 'expo.in' }, 'snap')
        .add(ignite, 'snap')
        .to(
          morph,
          {
            duration: SNAP_S,
            ease: 'expo.inOut',
            morphSVG: { shape: CHAR_MORPH_D, shapeIndex: NO_ROTATION, map: 'complexity' },
          },
          'snap',
        )
        .to(glowRef.current, { autoAlpha: 0.6, scale: 1.1, duration: 0.72, ease: 'expo.out' }, 'snap')
        .to(glowRef.current, { autoAlpha: 0.24, duration: 0.9, ease: 'power2.inOut' }, `snap+=0.6`)
        .addLabel('land', `snap+=${SNAP_S}`)
        .add(resolveExact, 'land')
        .to(root, { autoAlpha: 0, duration: 0.62, ease: 'power2.inOut' }, `land+=${LAND_HOLD_S}`)
        .to(
          artRef.current,
          { scale: 1.045, duration: 0.9, ease: 'expo.out' },
          `land+=${LAND_HOLD_S}`,
        )
        .add(finish, `land+=${LAND_HOLD_S + 0.72}`);
    }

    return () => {
      tl.kill();
      html.classList.remove('is-booting');
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
    };
  }, [resolveExact]);

  if (gone) return null;

  return (
    <div className="ldr" ref={rootRef} aria-hidden="true">
      <div className="ldr__bg" />
      <div className="ldr__glow" ref={glowRef} />
      <svg
        className="ldr__stage"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Desaturated — unlit neon. userSpaceOnUse keeps the material still
              while the numerals change width. */}
          <linearGradient id="ldr-dim" gradientUnits="userSpaceOnUse" x1="60" y1="440" x2="60" y2="740">
            <stop offset="0" stopColor="#c9ccd8" />
            <stop offset="0.58" stopColor="#8f94a6" />
            <stop offset="1" stopColor="#5f6478" />
          </linearGradient>
          <linearGradient id="ldr-holo" gradientUnits="userSpaceOnUse" x1="150" y1="1095" x2="900" y2="120">
            <stop offset="0" stopColor="var(--magenta)" />
            <stop offset="0.46" stopColor="var(--iris)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>

        {/* One translate takes the whole composition — art space and counter
            space are the same space — to the canvas centre. */}
        <g className="ldr__scene" transform={`translate(${COUNTER.artShiftX} ${COUNTER.artShiftY})`}>
          <g className="ldr__art" ref={artRef}>
            {/* Hidden until the snap. The effect only runs after first paint,
                so without this the baked "100" frame flashes under the live
                counter the moment the page opens. */}
            <path className="ldr__morph" ref={morphRef} d={DIGIT_MORPH_D} style={{ opacity: 0 }} />

            {exactArt && (
              <g className="ldr__exact" ref={exactRef}>
                {exactArt.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            )}

            <g
              className="ldr__pct"
              ref={pctRef}
              transform={`translate(${initialFrame.pctX} ${COUNTER.pctY}) scale(${COUNTER.pctScale})`}
            >
              <path d={glyphPath('%')} />
            </g>

            {Array.from({ length: DIGIT_SLOTS }, (_, slot) => {
              const ch = initialLabel[slot];
              return (
                <g
                  key={slot}
                  className="ldr__digit"
                  ref={(el) => {
                    digitRefs.current[slot] = el;
                  }}
                  transform={`translate(${initialFrame.origins[slot] ?? 0} ${
                    COUNTER.baseline
                  }) scale(${GLYPH_SCALE})`}
                  style={{ opacity: ch ? 1 : 0 }}
                >
                  <path
                    ref={(el) => {
                      digitPaths.current[slot] = el;
                    }}
                    d={ch ? glyphPath(ch) : undefined}
                    data-ch={ch}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
