import { useEffect } from 'react';

/* ---------------------------------------------------------------------------
   FloorState — the only JavaScript the curtain reveal needs.

   The reveal itself is pure CSS and pure native scroll: `.curtain-footer` is
   `position: sticky; bottom: 0` inside `.curtain-stage`, and the sign-off above
   it is pulled down over it with a negative margin. One scrolled pixel lifts
   the curtain by exactly one pixel — nothing here animates, pins, or
   intercepts scrolling.

   This component only measures and publishes numbers the CSS cannot compute
   on its own:

     --curtain-footer-height  the footer's real rendered height (ResizeObserver)
     --curtain-travel         how far the curtain is allowed to lift, i.e. the
                              sticky travel the stage grants the footer
     --curtain-progress       0 → 1, how much of the curtain has lifted
     --curtain-chrome-opacity 1 → 0, the fixed dark chrome fading out late in
                              the lift so it never sits on the bright floor
     html.at-floor            the lift is essentially finished

   `--curtain-travel` is 0 whenever the footer is taller than the viewport.
   A sticky `bottom: 0` footer is revealed with its *bottom* edge glued to the
   bottom of the screen, so a footer taller than the screen would have its top
   permanently above the fold — unreadable at that breakpoint. Zero travel
   collapses the whole rig back into an ordinary in-flow footer (see
   `.curtain-stage` in overhaul.css), which is also exactly what a
   JavaScript-less page gets.
--------------------------------------------------------------------------- */

/* The chrome holds still for the first third of the lift, then fades out. A
   fade that starts at the first scrolled pixel reads as "the page is
   dissolving" long before the floor is visible. */
const CHROME_HOLD = 0.3;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export default function FloorState() {
  useEffect(() => {
    const root = document.documentElement;
    const footer = document.querySelector<HTMLElement>('.curtain-footer');
    if (!footer) return;
    const signoff = document.querySelector<HTMLElement>('.footer.signoff');

    let raf = 0;
    let height = 0;
    let travel = 0;
    let atFloor = false;
    let lastProgress = -1;

    const measure = () => {
      height = footer.getBoundingClientRect().height;
      /* `visualViewport` follows the iOS Safari toolbar collapse the same way
         100dvh does; innerHeight is the fallback. Leave a couple of pixels of
         slack so a sub-pixel rounding never flips the guard on and off. */
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      travel = height > 0 && height <= viewport - 2 ? height : 0;
      root.style.setProperty('--curtain-footer-height', `${height}px`);
      root.style.setProperty('--curtain-travel', `${travel}px`);
    };

    const write = () => {
      const viewport = window.innerHeight;
      let progress: number;
      if (travel > 0 && signoff) {
        /* The hem of the curtain is the sign-off's bottom edge. How far it has
           risen past the bottom of the viewport is, pixel for pixel, how much
           of the floor is uncovered. */
        progress = clamp01((viewport - signoff.getBoundingClientRect().bottom) / travel);
      } else {
        /* No curtain (footer taller than the screen): fall back to "how much of
           the footer is on screen", so the chrome still gets out of the way. */
        const rect = footer.getBoundingClientRect();
        progress = clamp01((viewport - rect.top) / (rect.height || 1));
      }

      if (progress !== lastProgress) {
        lastProgress = progress;
        const chrome =
          progress <= CHROME_HOLD ? 1 : 1 - (progress - CHROME_HOLD) / (1 - CHROME_HOLD);
        root.style.setProperty('--curtain-progress', progress.toFixed(4));
        root.style.setProperty('--curtain-chrome-opacity', chrome.toFixed(4));
      }

      const next = progress >= 0.98;
      if (next !== atFloor) {
        atFloor = next;
        root.classList.toggle('at-floor', atFloor);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(write);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    measure();
    write();

    const resizeObserver = new ResizeObserver(remeasure);
    resizeObserver.observe(footer);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    window.visualViewport?.addEventListener('resize', remeasure);

    /* Keyboard parity: while the curtain is still down the footer's links are
       laid out behind it, so a browser scrolling a focused link "into view"
       would leave it hidden under the curtain. Tabbing into the floor takes
       the page to the floor. The jump is repeated over the next couple of
       frames because sections above can still be settling their height as
       they mount, which moves the bottom of the document under us. */
    const jumpToFloor = () => {
      let frames = 0;
      const step = () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
        write();
        if (++frames < 3) requestAnimationFrame(step);
      };
      step();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (travel <= 0 || lastProgress >= 0.98) return;
      if (!(event.target instanceof Node) || !footer.contains(event.target)) return;
      jumpToFloor();
    };
    document.addEventListener('focusin', onFocusIn);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      window.visualViewport?.removeEventListener('resize', remeasure);
      document.removeEventListener('focusin', onFocusIn);
      root.classList.remove('at-floor');
      root.style.removeProperty('--curtain-footer-height');
      root.style.removeProperty('--curtain-travel');
      root.style.removeProperty('--curtain-progress');
      root.style.removeProperty('--curtain-chrome-opacity');
    };
  }, []);

  return null;
}
