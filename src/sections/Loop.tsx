import { useCallback, useEffect, useRef, useState } from 'react';
import { Reveal } from '../components/ui';
import { LOOP_PILLARS } from '../lib/data';
import { webglSupported } from './pulls/webgl';
import FluidHeadline from './loop/FluidHeadline';
import LoopScene, { type FrameData } from './loop/LoopScene';
import NarrativeScroll, { type NarrativePhrase } from './loop/NarrativeScroll';

/* ============================================================================
   08 · THE LOOP — "One loop. Nothing wasted."

   Rebuilt as a pinned piece of cinema:
     · "NOTHING WASTED" is a WebGL fluid surface that warps into the cursor's
       wake and settles the instant the pointer rests
     · the flywheel copy is a scroll-tied sequence — one phase illuminated at a
       time, the phases already travelled dimmed behind it
     · the diagram is a real 3D system: a volumetric core, four nodes at
       different Z depths, glowing splines with light travelling along them, a
       lerped focus camera and a magnetic, light-casting cursor
     · palette discipline: cyan = active pathway, magenta = interactive state,
       everything else is void black and silver
   ========================================================================== */

const PHRASES: NarrativePhrase[] = [
  { n: '01', text: 'The Persona teases the next universe.' },
  { n: '02', text: 'Fans arrive at the Hub.' },
  { n: '03', text: 'Holders claim first.' },
  { n: '04', text: 'Every purchase pulls a piece.' },
  { n: '05', text: 'Fans post the pull.' },
  { n: '06', text: 'The Persona amplifies.' },
  { n: '07', text: 'The Nemoverse grows.' },
];

/* approximate glass-card box — used to flip a card inward near an edge and to
   keep it clear of the pinned copy bands */
const CARD_W = 300;
const CARD_H = 180;

/* CSS-only resting positions — used when WebGL is unavailable. */
const FALLBACK_POS = [
  { left: '24%', top: '22%' },
  { left: '76%', top: '22%' },
  { left: '76%', top: '78%' },
  { left: '24%', top: '78%' },
];

export default function Loop() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  /* clear band between the pinned headline and the narrative, as fractions of
     the stage — measured so cards never sit on top of the copy */
  const bandsRef = useRef({ top: 0.3, bottom: 0.86 });
  const [hover, setHover] = useState(-1);
  const hoverRef = useRef(-1);
  const [webgl] = useState(() => webglSupported());
  const compactRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const on = () => {
      compactRef.current = mq.matches;
    };
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const measure = () => {
      const stage = document.querySelector('.loop__stage');
      const head = document.querySelector('.loop__head');
      const narrative = document.querySelector('.loop__narrative');
      if (!stage || !head || !narrative) return;
      const s = stage.getBoundingClientRect();
      if (!s.height) return;
      bandsRef.current = {
        top: (head.getBoundingClientRect().bottom - s.top) / s.height,
        bottom: (narrative.getBoundingClientRect().top - s.top) / s.height,
      };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const setHoverIdx = useCallback((i: number) => {
    if (hoverRef.current === i) return;
    hoverRef.current = i;
    setHover(i);
  }, []);

  /* The scene projects the core + nodes to screen space every frame; those
     coordinates are written straight onto the DOM overlays — no React
     re-render per frame. */
  const handleFrame = useCallback((f: FrameData) => {
    const compact = compactRef.current;
    const core = coreRef.current;
    if (core) {
      core.style.transform = `translate3d(${f.core.x.toFixed(1)}px, ${f.core.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${f.core.scale.toFixed(3)})`;
      core.style.filter = f.core.blur > 0.15 ? `blur(${f.core.blur.toFixed(2)}px)` : 'none';
      core.style.opacity = (1 - Math.min(0.7, f.core.blur * 0.07)).toFixed(3);
    }

    const w = f.size.w;
    for (let i = 0; i < f.nodes.length; i++) {
      const nd = f.nodes[i];
      const wrap = nodeRefs.current[i];
      if (!wrap) continue;
      /* keep the glass card inside the frame on narrow screens */
      const x = compact ? Math.min(Math.max(nd.x, 88), Math.max(88, w - 88)) : nd.x;
      wrap.style.transform = `translate3d(${x.toFixed(1)}px, ${nd.y.toFixed(1)}px, 0)`;
      wrap.style.setProperty('--ns', nd.scale.toFixed(3));
      /* cards open away from the core, but flip inward when the outer edge
         has no room left — the glass can never leave the frame */
      const gap = 70;
      const wantRight = x >= w * 0.5;
      const fitsRight = x + gap + CARD_W <= w - 12;
      const fitsLeft = x - gap - CARD_W >= 12;
      const side = wantRight ? (fitsRight ? 'right' : 'left') : fitsLeft ? 'left' : 'right';
      if (wrap.dataset.side !== side) wrap.dataset.side = side;

      /* narrow screens stack the card under (or over) the node */
      const vpos = nd.y > f.size.h * 0.55 ? 'above' : 'below';
      if (wrap.dataset.vpos !== vpos) wrap.dataset.vpos = vpos;

      if (compact) {
        const half = CARD_W / 2;
        let shift = 0;
        if (x + half > w - 10) shift = w - 10 - (x + half);
        if (x - half + shift < 10) shift = 10 - (x - half);
        wrap.style.setProperty('--cardshift', `${shift.toFixed(1)}px`);
        wrap.style.setProperty('--cardshiftY', '0px');
      } else {
        /* keep the glass out of the copy bands above and below the orbit */
        const minTop = f.size.h * bandsRef.current.top + 14;
        const maxBottom = f.size.h * bandsRef.current.bottom - 14;
        let sy = 0;
        if (nd.y - CARD_H / 2 < minTop) sy = minTop - (nd.y - CARD_H / 2);
        if (nd.y + CARD_H / 2 + sy > maxBottom) sy = maxBottom - (nd.y + CARD_H / 2);
        wrap.style.setProperty('--cardshiftY', `${sy.toFixed(1)}px`);
      }
      const chip = chipRefs.current[i];
      if (chip) {
        chip.style.filter = nd.blur > 0.12 ? `blur(${Math.min(2.6, nd.blur).toFixed(2)}px)` : 'none';
      }
    }
  }, []);

  /* the stage ships its own cursor — retire the global one while inside */
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const on = () => document.body.classList.add('loop-cursor');
    const off = () => document.body.classList.remove('loop-cursor');
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerleave', off);
    return () => {
      el.removeEventListener('pointerenter', on);
      el.removeEventListener('pointerleave', off);
      off();
    };
  }, []);

  /* Touch: the first tap opens the card, the second follows the link. The
     armed ref — not the live hover state — decides, so a fast tap can never
     race the scene's own proximity focus and navigate on the first press. */
  const armedRef = useRef(-1);
  const onHitClick = (e: React.MouseEvent, i: number) => {
    if (!compactRef.current) return;
    if (armedRef.current !== i) {
      e.preventDefault();
      armedRef.current = i;
      setHoverIdx(i);
    }
  };

  return (
    <section className="section loop" id="loop">
      <div className="loop__void" aria-hidden="true" />

      <div className="loop__track" ref={trackRef} data-static={webgl ? 'false' : 'true'}>
        <div className="loop__sticky" ref={stickyRef}>
          <div className="shell loop__frame">
            <header className="loop__head">
              <span className="kicker">HOW IT ALL CONNECTS</span>
              <h2 className="display loop__title">
                <span className="loop__title-line">One loop.</span>
                <FluidHeadline text="NOTHING WASTED" className="loop__title-line loop__title-fluid" />
              </h2>
            </header>

            {webgl ? (
              <LoopScene
                items={LOOP_PILLARS}
                trackRef={trackRef}
                hoverRef={hoverRef}
                onFrame={handleFrame}
                onHoverChange={setHoverIdx}
              >
                <div className="loop__nodes" data-fallback="false">
                  <div className="loop__corelabel" ref={coreRef}>
                    <b>THE</b>
                    <b>NEMOVERSE</b>
                    <span>the engine</span>
                  </div>

                  {LOOP_PILLARS.map((p, i) => (
                    <div
                      className="loop__node"
                      key={p.n}
                      data-active={hover === i}
                      data-side="right"
                      ref={(el) => {
                        nodeRefs.current[i] = el;
                      }}
                    >
                      <span
                        className="loop__chip"
                        ref={(el) => {
                          chipRefs.current[i] = el;
                        }}
                      >
                        <i className="loop__chip-dot" aria-hidden="true" />
                        {p.n}
                      </span>

                      <a
                        className="loop__hit"
                        href={p.target}
                        aria-label={`${p.n} — ${p.name}. ${p.body}`}
                        onFocus={() => setHoverIdx(i)}
                        onBlur={() => setHoverIdx(-1)}
                        onClick={(e) => onHitClick(e, i)}
                      />

                      <article className="loop__card" data-active={hover === i} aria-hidden={hover !== i}>
                        <span className="loop__card-line">
                          <span className="loop__card-meta">
                            {p.n} · {p.tag}
                          </span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-name">{p.name}</span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-body">{p.body}</span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-cta">
                            Enter <em>→</em>
                          </span>
                        </span>
                      </article>
                    </div>
                  ))}
                </div>
              </LoopScene>
            ) : (
              <div className="loop__stage loop__stage--flat">
                <span className="loop__ring loop__ring--a" aria-hidden="true" />
                <span className="loop__ring loop__ring--b" aria-hidden="true" />
                <div className="loop__nodes" data-fallback="true">
                  <div className="loop__corelabel" ref={coreRef}>
                    <b>THE</b>
                    <b>NEMOVERSE</b>
                    <span>the engine</span>
                  </div>
                  {LOOP_PILLARS.map((p, i) => (
                    <div
                      className="loop__node"
                      key={p.n}
                      data-active={hover === i}
                      data-side={i === 0 || i === 3 ? 'left' : 'right'}
                      style={{ left: FALLBACK_POS[i].left, top: FALLBACK_POS[i].top }}
                      ref={(el) => {
                        nodeRefs.current[i] = el;
                      }}
                    >
                      <span
                        className="loop__chip"
                        ref={(el) => {
                          chipRefs.current[i] = el;
                        }}
                      >
                        <i className="loop__chip-dot" aria-hidden="true" />
                        {p.n}
                      </span>
                      <a
                        className="loop__hit"
                        href={p.target}
                        aria-label={`${p.n} — ${p.name}. ${p.body}`}
                        onFocus={() => setHoverIdx(i)}
                        onBlur={() => setHoverIdx(-1)}
                      />
                      <article className="loop__card" data-active={hover === i} aria-hidden={hover !== i}>
                        <span className="loop__card-line">
                          <span className="loop__card-meta">
                            {p.n} · {p.tag}
                          </span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-name">{p.name}</span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-body">{p.body}</span>
                        </span>
                        <span className="loop__card-line">
                          <span className="loop__card-cta">
                            Enter <em>→</em>
                          </span>
                        </span>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="loop__gap" aria-hidden="true" />

            <NarrativeScroll phrases={PHRASES} trackRef={trackRef} pinned={webgl} />
          </div>
        </div>
      </div>

      <Reveal delay={0.2}>
        <p className="loop__note">
          ◆ THE DIFFERENCE BETWEEN SCATTERED COMMISSIONS AND{' '}
          <b>ONE GROWING, SELF-FUNDING ECOSYSTEM</b>
        </p>
      </Reveal>
    </section>
  );
}
