/* ---------------------------------------------------------------------------
   NEMO — THE WANDERER BETWEEN
   Canon-only generative persona chat.

   Construction notes
   ------------------
   · Volumetric glass — an animated mesh-gradient plate sits *behind* the panel
     so the panel's own backdrop-filter (blur 24 / saturate 150) genuinely
     refracts it. A 1px inner gradient hairline at 135° fakes light landing on
     the top-left edge, and a specular highlight tracks the pointer.
   · The mesh reacts to pointer position (and gyro on mobile) through lerped
     --mx / --my custom properties, and breathes on a slow keyframe loop.
   · Mount choreography — the panel scales 0.95 → 1 while its backdrop blur
     interpolates 0 → 24px, with the internal rows stagger-fading in.
   · Replies resolve with a scramble/mask reveal rather than appearing whole.
   · Send button + suggestion pills are magnetic (spring physics).
   Everything degrades cleanly under prefers-reduced-motion.
--------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import { MagneticButton, RollText } from './motion';
import { ScrambleText, StaticText } from './ScrambleText';
import { CHAT_FALLBACKS, CHAT_RULES, PERSONA_GREETING, QUICK_REPLIES } from '../lib/data';

interface Msg {
  id: number;
  who: 'nemo' | 'user';
  text: string;
  ts: string;
  /** Freshly generated → play the scramble reveal. */
  live: boolean;
}

const MAX_LEN = 280;

const stamp = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function replyFor(input: string): string[] {
  for (const rule of CHAT_RULES) if (rule.match.test(input)) return rule.reply;
  return [CHAT_FALLBACKS[Math.floor(Math.random() * CHAT_FALLBACKS.length)]];
}

/* Small-screen detection so the composer placeholder never gets clipped. */
function useCompact(query = '(max-width: 620px)') {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return compact;
}

/* -------------------------------------------------------------------------
   Mesh parallax — pointer + gyro drive two lerped custom properties.
------------------------------------------------------------------------- */
function useMeshParallax(host: React.RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const el = host.current;
    if (!el || !enabled) return;

    const target = { x: 0.5, y: 0.42 };
    const current = { x: 0.5, y: 0.42 };
    let raf = 0;
    let settled = false;

    const loop = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      el.style.setProperty('--mx', current.x.toFixed(4));
      el.style.setProperty('--my', current.y.toFixed(4));
      const done =
        Math.abs(target.x - current.x) < 0.0015 && Math.abs(target.y - current.y) < 0.0015;
      if (done) {
        settled = true;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      settled = false;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      // Sample generously outside the panel so the light keeps moving as the
      // cursor approaches from the page.
      const pad = 260;
      if (
        e.clientX < r.left - pad ||
        e.clientX > r.right + pad ||
        e.clientY < r.top - pad ||
        e.clientY > r.bottom + pad
      ) {
        return;
      }
      target.x = Math.max(-0.15, Math.min(1.15, (e.clientX - r.left) / r.width));
      target.y = Math.max(-0.15, Math.min(1.15, (e.clientY - r.top) / r.height));
      kick();
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(0, Math.min(1, 0.5 + e.gamma / 70));
      target.y = Math.max(0, Math.min(1, 0.5 + (e.beta - 45) / 80));
      kick();
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onOrient);
    kick();

    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onOrient);
      if (raf) cancelAnimationFrame(raf);
      void settled;
    };
  }, [host, enabled]);
}

/* -------------------------------------------------------------------------
   Suggestion rail — mask-image fade tracks the horizontal scroll position so
   overflowing pills dissolve into the glass instead of being clipped.
------------------------------------------------------------------------- */
function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = Math.min(1, el.scrollLeft / 48);
    const right = max > 1 ? Math.min(1, (max - el.scrollLeft) / 48) : 0;
    el.style.setProperty('--fade-l', `${(left * 56).toFixed(1)}px`);
    el.style.setProperty('--fade-r', `${(right * 72).toFixed(1)}px`);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);

  return ref;
}

/* ------------------------------------------------------------------------- */

const rowVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
};

const shellVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 26 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1] as const,
      staggerChildren: 0.075,
      delayChildren: 0.22,
    },
  },
};

export default function NemoChat() {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const railRef = useEdgeFade<HTMLDivElement>();
  const inView = useInView(hostRef, { once: true, margin: '-12% 0px -12% 0px' });
  const compact = useCompact();

  const seq = useRef(1);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 0, who: 'nemo', text: PERSONA_GREETING, ts: stamp(), live: true },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  useMeshParallax(hostRef, !reduce);

  /* Mount choreography: blur interpolates 0 → 24px as the panel scales in. */
  const blur = useMotionValue(reduce ? 24 : 0);
  const backdrop = useMotionTemplate`blur(${blur}px) saturate(150%)`;

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      blur.set(24);
      return;
    }
    const controls = animate(blur, 24, { duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.08 });
    return () => controls.stop();
  }, [inView, reduce, blur]);

  const pin = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    pin();
  }, [msgs, typing, pin]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || typing) return;

      setMsgs((m) => [...m, { id: seq.current++, who: 'user', text, ts: stamp(), live: false }]);
      setInput('');
      setTyping(true);

      const replies = replyFor(text);
      replies.forEach((reply, i) => {
        window.setTimeout(
          () => {
            setMsgs((m) => [
              ...m,
              { id: seq.current++, who: 'nemo', text: reply, ts: stamp(), live: true },
            ]);
            if (i === replies.length - 1) setTyping(false);
          },
          620 + i * 900,
        );
      });
    },
    [typing],
  );

  const counter = useMemo(() => `${String(input.length).padStart(3, '0')} / ${MAX_LEN}`, [input]);

  return (
    <div className="nchat" ref={hostRef} data-reduce={reduce ? 'true' : 'false'}>
      {/* Layer 3 — animated mesh gradient, refracted by the glass above it */}
      <div className="nchat__mesh" aria-hidden="true" />
      <div className="nchat__mesh nchat__mesh--far" aria-hidden="true" />

      <motion.div
        className="nchat__glass"
        variants={shellVariants}
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        style={{ backdropFilter: backdrop, WebkitBackdropFilter: backdrop }}
      >
        {/* Layer 2 — 1px gradient hairline + pointer-tracked specular sheen */}
        <span className="nchat__edge" aria-hidden="true" />
        <span className="nchat__specular" aria-hidden="true" />

        <motion.header className="nchat__head" variants={rowVariants}>
          <span className="nchat__sigil" aria-hidden="true">
            N
          </span>
          <span className="nchat__ident">
            <b>NEMO</b>
            <em>the wanderer between</em>
          </span>
          <span className="nchat__status">
            <i className="nchat__live" aria-hidden="true" />
            ONLINE · IN CHARACTER
          </span>
        </motion.header>

        <motion.div
          className="nchat__log"
          ref={logRef}
          variants={rowVariants}
          role="log"
          aria-live="polite"
          aria-label="Conversation with NEMO"
        >
          {msgs.map((m) => (
            <motion.article
              key={m.id}
              className={`nmsg ${m.who === 'user' ? 'nmsg--user' : 'nmsg--nemo'}`}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="nmsg__ava" aria-hidden="true">
                {m.who === 'user' ? 'U' : 'N'}
              </span>
              <div className="nmsg__stack">
                <span className="nmsg__meta">
                  {m.who === 'user' ? 'YOU' : 'NEMO'} <i>·</i> {m.ts}
                </span>
                <div className={`nmsg__bubble ${m.live && !reduce && inView ? 'is-revealing' : ''}`}>
                  {m.who === 'nemo' && m.live ? (
                    <ScrambleText text={m.text} active={inView} onUpdate={pin} />
                  ) : (
                    <StaticText text={m.text} />
                  )}
                </div>
              </div>
            </motion.article>
          ))}

          {typing && (
            <div className="nmsg nmsg--nemo nmsg--typing">
              <span className="nmsg__ava" aria-hidden="true">
                N
              </span>
              <div className="nmsg__stack">
                <span className="nmsg__meta">NEMO <i>·</i> COMPOSING</span>
                <div className="nmsg__bubble nmsg__bubble--typing" aria-label="NEMO is typing">
                  <i className="nchat__dot" />
                  <i className="nchat__dot" />
                  <i className="nchat__dot" />
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div className="nchat__railwrap" variants={rowVariants}>
          <span className="nchat__raillabel">SUGGESTED</span>
          <div className="nchat__rail" ref={railRef}>
            {QUICK_REPLIES.map((q) => (
              <MagneticButton
                key={q}
                type="button"
                className="npill"
                innerClassName="npill__label"
                radius={24}
                strength={0.3}
                max={10}
                onClick={() => send(q)}
                disabled={typing}
              >
                <RollText text={q} />
              </MagneticButton>
            ))}
          </div>
        </motion.div>

        <motion.form
          className="nchat__composer"
          variants={rowVariants}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="nchat__field">
            <span className="nchat__prompt" aria-hidden="true">
              ›
            </span>
            <input
              ref={inputRef}
              className="nchat__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={compact ? 'ask in canon…' : 'ask NEMO anything in canon…'}
              aria-label="Message NEMO"
              maxLength={MAX_LEN}
              autoComplete="off"
              spellCheck={false}
            />
            <MagneticButton
              type="submit"
              className="nchat__send"
              innerClassName="nchat__sendlabel"
              radius={28}
              strength={0.4}
              max={14}
              disabled={typing || !input.trim()}
              aria-label="Send message to NEMO"
            >
              <RollText text="SEND" />
            </MagneticButton>
          </div>
        </motion.form>

        <motion.footer className="nchat__foot" variants={rowVariants}>
          <p className="nchat__note">
            PERSONA RESPONSES ARE GENERATIVE <i>·</i> CANON-ONLY GUARDRAILS ON
          </p>
          <p className="nchat__count" aria-hidden="true">
            {counter}
          </p>
        </motion.footer>
      </motion.div>
    </div>
  );
}
