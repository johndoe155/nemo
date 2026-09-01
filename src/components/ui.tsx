import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCountdown } from '../lib/hooks';
import { KineticButton, MagneticButton, RollText } from './motion';
import type { Rarity } from '../lib/data';
import { RARITY } from '../lib/data';

/* ------------------------------ Verified mark ------------------------------ */

export function Verified({ color = '#3FE8FF' }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-label="verified">
      <path
        d="M12 1.8l2.6 2.1 3.3-.5 1.2 3.1 3.1 1.3-.4 3.3 2.1 2.6-2.1 2.6.4 3.3-3.1 1.3-1.2 3.1-3.3-.5L12 25.6l-2.6-2.1-3.3.5-1.2-3.1-3.1-1.3.4-3.3L.1 13.5l2.1-2.6-.4-3.3 3.1-1.3L6.1 3.2l3.3.5L12 1.8z"
        fill="url(#vg)"
        stroke="none"
      />
      <path
        d="M7.6 12.4l2.8 2.9 5.9-6"
        stroke="#05050A"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor={color} />
          <stop offset="1" stopColor="#8A4DFF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ------------------------------ Section head ------------------------------ */

export function SectionHead({
  kicker,
  title,
  sub,
  center,
  kickerGold,
  id,
  num,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  center?: boolean;
  kickerGold?: boolean;
  id?: string;
  num?: string;
}) {
  return (
    <div className={`sechead ${center ? 'sechead--center' : ''}`} id={id}>
      {num && <span className={`sechead__num ${kickerGold ? 'gold-num' : ''}`} aria-hidden="true">{num}</span>}
      <span className={`kicker ${kickerGold ? 'gold' : ''}`}>{kicker}</span>
      <h2 className="display">
        <Reveal>{title}</Reveal>
      </h2>
      {sub && (
        <div className="sub">
          <Reveal delay={0.12}>{sub}</Reveal>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Reveal (motion) ------------------------------ */

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ Marquee ------------------------------ */

export function Marquee({ items, speed = '36s' }: { items: string[]; speed?: string }) {
  const row = (key: string) => (
    <div className="marquee__item" key={key}>
      {items.map((t, i) => (
        <span key={`${key}-${i}`}>
          <span className="star">✦</span> {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee" style={{ '--speed': speed }}>
      <div className="marquee__track">
        {row('a')}
        {row('b')}
      </div>
    </div>
  );
}

/* ------------------------------ Countdown ------------------------------ */

export function Countdown({ target }: { target: string }) {
  const t = useCountdown(target);
  const cells: Array<[string, string]> = [
    [t.d, 'days'],
    [t.h, 'hrs'],
    [t.m, 'min'],
    [t.s, 'sec'],
  ];
  return (
    <div className="countdown" role="timer" aria-label="Countdown to next drop">
      {cells.map(([v, l]) => (
        <div className="countdown__cell" key={l}>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Mock wallet button ------------------------------ */

export const MOCK_ADDRESS = '0x7F3C…9A21';

export function useMockWallet() {
  const [connected, setConnected] = useState(false);

  // Non-critical preference: persist the "connected" demo state.
  useEffect(() => {
    try {
      if (localStorage.getItem('ocu-wallet') === '1') setConnected(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const connect = () => {
    setConnected(true);
    try {
      localStorage.setItem('ocu-wallet', '1');
    } catch {
      /* ignore */
    }
  };
  const disconnect = () => {
    setConnected(false);
    try {
      localStorage.removeItem('ocu-wallet');
    } catch {
      /* ignore */
    }
  };
  return { connected, connect, disconnect };
}

export function WalletButton({
  connected,
  onConnect,
  compact,
  label = 'CONNECT WALLET',
}: {
  connected: boolean;
  onConnect: () => void;
  compact?: boolean;
  label?: string;
}) {
  if (connected) {
    return (
      <MagneticButton
        className={`btn btn-ghost ${compact ? 'nav__cta' : ''}`}
        preset={compact ? 'chrome' : 'pill'}
        onClick={onConnect}
        title="Demo state — disconnects this mock session"
        data-cursor="UNLINK"
      >
        <span className="pulse-dot" style={{ width: 7, height: 7 }} />
        <span className="btn__txt">{MOCK_ADDRESS}</span>
      </MagneticButton>
    );
  }
  return (
    <KineticButton
      className={`btn btn-primary ${compact ? 'nav__cta' : ''}`}
      preset={compact ? 'chrome' : 'pill'}
      onClick={onConnect}
      label={label}
      swap="LINK THE VAULT"
      cursor="LINK"
    />
  );
}

/* ------------------------------ Rarity badge ------------------------------ */

export function RarityBadge({ rarity, small }: { rarity: Rarity; small?: boolean }) {
  const r = RARITY[rarity];
  return (
    <span
      className={small ? 'badge' : 'badge'}
      style={{ '--c': r.color, fontSize: small ? '0.56rem' : undefined }}
    >
      {r.label}
    </span>
  );
}

/* ------------------------------ Stars background ------------------------------ */

export function Starfield({
  className = '',
  density = 240,
  drift = true,
}: {
  className?: string;
  density?: number;
  drift?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let w = 0;
    let h = 0;

    interface Star {
      x: number;
      y: number;
      r: number;
      a: number;
      tw: number;
      ph: number;
      vx: number;
      vy: number;
      hue: string;
    }
    const COLORS = ['#ffffff', '#ffffff', '#c9d6ff', '#8a4dff', '#3fe8ff', '#ffc857'];
    let stars: Star[] = [];

    const seed = () => {
      stars = Array.from({ length: density }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.25,
        a: Math.random() * 0.55 + 0.15,
        tw: Math.random() * 0.012 + 0.004,
        ph: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        hue: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    };

    const resize = () => {
      // The canvas is position:fixed — size it to the viewport, not the
      // parent's scroll height (avoids multi-hundred-MB canvases).
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const t = performance.now();
      for (const s of stars) {
        if (drift && !reduce) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0) s.x = w;
          if (s.x > w) s.x = 0;
          if (s.y < 0) s.y = h;
          if (s.y > h) s.y = 0;
        }
        const twinkle = 0.72 + 0.28 * Math.sin(t * s.tw * 1000 + s.ph);
        ctx.beginPath();
        ctx.fillStyle = s.hue;
        ctx.globalAlpha = s.a * twinkle;
        ctx.arc(s.x, s.y, s.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density, drift]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/* ------------------------------ Sort dropdown ------------------------------ */

export type SortMode = 'newest' | 'oldest' | 'rarity' | 'price';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'NEWEST FIRST' },
  { value: 'oldest', label: 'OLDEST FIRST' },
  { value: 'rarity', label: 'BY RARITY' },
  { value: 'price', label: 'BY PRICE' },
];

export function SortDropdown({
  value,
  onChange,
  label = 'Sort universes',
}: {
  value: SortMode;
  onChange: (next: SortMode) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, SORT_OPTIONS.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selected = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    setActive(Math.max(0, SORT_OPTIONS.findIndex((o) => o.value === value)));
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.sort-dd__trigger')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[active];
    el?.focus();
  }, [open, active]);

  const choose = (mode: SortMode) => {
    onChange(mode);
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('.sort-dd__trigger')?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % SORT_OPTIONS.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(SORT_OPTIONS.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(SORT_OPTIONS[active].value);
    }
  };

  return (
    <div className={`sort-dd ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="sort-dd__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
      >
        <span>
          <RollText text={selected.label} />
        </span>
        <svg className="sort-dd__chev" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
      <ul
        ref={listRef}
        className="sort-dd__menu"
        role="listbox"
        aria-label={label}
        aria-hidden={!open}
        hidden={!open}
        onKeyDown={onListKey}
      >
        {SORT_OPTIONS.map((opt, i) => (
          <li
            key={opt.value}
            role="option"
            tabIndex={open && i === active ? 0 : -1}
            aria-selected={opt.value === value}
            className={`sort-dd__opt ${opt.value === value ? 'is-selected' : ''} ${i === active ? 'is-active' : ''}`}
            style={{ ['--i' as string]: i }}
            onClick={() => choose(opt.value)}
            onMouseEnter={() => setActive(i)}
          >
            {opt.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Toast feedback ------------------------------ */

type ToastPayload = { msg: string };

export function toast(msg: string) {
  try {
    window.dispatchEvent(new CustomEvent<ToastPayload>('ocu:toast', { detail: { msg } }));
  } catch {
    /* noop */
  }
}

export function ToastHost() {
  const [items, setItems] = useState<Array<{ id: number; msg: string }>>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const { msg } = (e as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      setItems((p) => [...p, { id, msg }]);
      window.setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 2600);
    };
    window.addEventListener('ocu:toast', on);
    return () => window.removeEventListener('ocu:toast', on);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            className="toast"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {it.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
