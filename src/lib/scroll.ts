/* ---------------------------------------------------------------------------
   scroll.ts — ONE scroll authority for the page (DESIGN_AUDIT P1).

   Before this module, scroll position had six independent readers (Nav's
   scrolled state, ScrollProgress, the since-deleted VelocityFX component,
   useScrollspy, the mobile carriage, the pinned roster) each pacing itself against whatever the
   browser happened to do, with a framer useSpring stacked on top as a second
   smoothing layer and `scroll-behavior: smooth` on html as a third. That is
   why the page felt mushy on a trackpad and why GSAP refreshes had to fight
   the CSS smoothing (see the `prepareForRefresh` dance in SignoffHorizon.tsx
   — this module makes that fight moot).

   Contract:
   · Lenis owns WHEEL smoothing. Touch stays native (1.x default) — mobile
     momentum and every horizontal track keep behaving exactly as before.
   · Lenis's raf rides the GSAP ticker (autoRaf: false), so the site runs one
     rAF cadence: Lenis → ScrollTrigger.update → framer's per-frame reads.
   · prefers-reduced-motion: the instance is still created (respectReducedMotion
     forces lerp 1 / instant programmatic scrolls) so hold/lock/pageScrollTo
     keep one implementation path everywhere.
   · Everything that MOVES the page (anchor links, goToCard, the drag
     handoff) goes through this module; readers keep subscribing to native
     `scroll` events, which Lenis's programmatic writes fire — they simply
     see continuous values now.
   · Hold keys coordinate the boot loader, the dialog scroll-lock and GSAP
     refreshes around a single stopped/started flag, so nothing can scroll —
     or animate a scroll — while the loader measures, a section locks the
     page, or ScrollTrigger re-measures the document.
--------------------------------------------------------------------------- */

import Lenis from 'lenis';
import { emitScrollTick } from './sound';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let lenis: Lenis | null = null;
let initialized = false;
const holds = new Set<string>();
const locks = new Set<string>();

/** Hold keys that stop Lenis while the page must not move. */
function applyHolds() {
  if (!lenis) return;
  if (holds.size > 0) lenis.stop();
  else lenis.start();
}

export function holdScroll(key: string) {
  holds.add(key);
  applyHolds();
}

export function releaseScroll(key: string) {
  holds.delete(key);
  applyHolds();
}

/** Modal scroll-lock: freezes the viewport behind an open dialog/menu.
 *  body-overflow covers the no-Lenis paths (the value propagates to the
 *  root scroller because `html` stays `visible`); the hold stops Lenis so a
 *  stopped instance never accumulates wheel target — the position you
 *  unlock at is the position you locked at, no snap. `scrollbar-gutter:
 *  stable` on html keeps the layout width fixed across the lock. */
export function lockPage(key: string) {
  locks.add(key);
  holdScroll(key);
  document.body.style.overflow = 'hidden';
}

export function unlockPage(key: string) {
  locks.delete(key);
  if (locks.size === 0) document.body.style.overflow = '';
  releaseScroll(key);
}

export function getLenis(): Lenis | null {
  return lenis;
}

/** Programmatic page scroll for consumers (roster carriage, goToCard, ...).
 *  smooth:false mirrors the old `behavior: 'auto'` handoff — position swaps
 *  with no animation — but routes it through Lenis so its internal value
 *  re-syncs instead of reading a foreign jump as user input. */
export function pageScrollTo(
  top: number,
  opts: { smooth?: boolean; duration?: number; onComplete?: () => void } = {},
) {
  const { smooth = false, duration = 1.1, onComplete } = opts;
  if (lenis) {
    lenis.scrollTo(Math.round(top), {
      immediate: !smooth,
      ...(smooth ? { duration } : {}),
      force: true,
      ...(onComplete ? { onComplete } : {}),
    });
    return;
  }
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  onComplete?.();
}

function navOffset(): number {
  const nav = document.querySelector<HTMLElement>('.nav');
  return (nav?.offsetHeight ?? 78) + 14;
}

/* Anchor navigation: `#id` links glide via Lenis and settle with the nav
   bar cleared, the hash enters history, and the target receives focus
   (preventScroll — the animation above owns the position). Without Lenis
   (nothing initialized yet) the native href jump happens untouched. */
function onAnchorClick(event: MouseEvent) {
  if (!lenis || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  if (href.length < 2) return;
  const id = decodeURIComponent(href.slice(1));
  const target = document.getElementById(id);
  if (!target || target === document.body) return;
  event.preventDefault();
  if (window.location.hash !== href) window.history.pushState(null, '', href);
  lenis.scrollTo(target, { offset: -navOffset(), duration: 1.15, force: true });
  /* Focus moves immediately: `preventScroll` keeps the animation above
     authoritative, and doing it here (not in an onComplete) means the
     focus lands even when respectReducedMotion makes the glide instant —
     Lenis fires `onComplete` inconsistently on immediate jumps. */
  if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function initSmoothScroll(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  /* One registration for the whole app — every ScrollTrigger consumer
     (Lore's drilling rod, the Sign-off hold, the boot guards) shares it. */
  gsap.registerPlugin(ScrollTrigger);

  lenis = new Lenis({
    /* One rAF cadence: the ticker below is the only raf Lenis runs. */
    autoRaf: false,
    /* Expo-ish settle — deliberately not too slow; the page scrolls long. */
    lerp: 0.09,
    wheelMultiplier: 1,
    /* Touch stays native (1.x default): mobile momentum and the horizontal
       rack are untouched; Lenis only re-syncs from their scroll events. */
    smoothWheel: true,
    /* Reduced motion: 1:1 tracking, instant programmatic scrolls — the
       instance exists so lock/hold/scrollTo keep one code path. */
    respectReducedMotion: true,
    autoResize: true,
  });

  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ScrollTrigger keeps its own native-scroll listener, but under Lenis the
     authoritative beat is the instance's — drive updates from there. */
  lenis.on('scroll', () => ScrollTrigger.update());

  /* Sound's cadence source (DESIGN_AUDIT 3.4: the gravity bed updates at
     10 Hz off the scroll channel, never per-frame). Native 'scroll' fires
     whether or not Lenis exists — one passive listener, self-throttled by
     its consumers; the engine stays ignorant of what listens. */
  window.addEventListener('scroll', emitScrollTick, { passive: true });

  /* A refresh is violent for measured layouts: GSAP records the scroll,
     jumps to 0, repositions every trigger, then jumps back. The old code
     had to switch CSS `scroll-behavior` off around that (SignoffHorizon's
     prepareForRefresh); with Lenis, stopping the instance is the same
     freeze, applied once for EVERY consumer instead of each section
     re-inventing it. */
  ScrollTrigger.addEventListener('refreshInit', () => holdScroll('st-refresh'));
  ScrollTrigger.addEventListener('refresh', () => releaseScroll('st-refresh'));

  document.addEventListener('click', onAnchorClick);

  /* Layout moves after boot (fonts landing, images decoding). Re-sync the
     engine to wherever the page actually stands, and let ScrollTrigger
     re-measure once the type settles. scrollTo(window.scrollY, immediate)
     is the documented recovery for restored-scroll reloads. */
  const sync = () => {
    if (!lenis) return;
    lenis.scrollTo(window.scrollY, { immediate: true });
  };
  window.addEventListener('load', () => {
    sync();
    ScrollTrigger.refresh();
  });
  document.fonts?.ready.then(() => {
    sync();
    /* The gate in Loader.tsx means fonts normally land BEFORE the page is
       revealed, but a cold cache on a slow network swaps type after the
       release — and a swap reflows every tracked label on this page. One
       refresh after fonts settle keeps the scrubbed triggers measured
       against the final layout; the boot guard's own refreshes stay
       untouched. */
    ScrollTrigger.refresh();
  });
}
