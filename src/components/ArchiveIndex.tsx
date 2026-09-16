import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { WalletButton, useMockWallet } from './ui';
import { useChapter, useQuality, isBehindResume, readResume } from '../lib/ChapterProvider';
import { CHAPTERS, CHAPTER_ANCHOR, CHAPTER_ORDER } from '../lib/chapters';
import { useFocusTrap } from '../lib/hooks';
import { useInterfaceSound } from '../lib/useInterfaceSound';
import { lockPage, unlockPage } from '../lib/scroll';
import { LOGO_SRC } from '../lib/assets';

/* ============================================================================
   ArchiveIndex — the navigation, rebuilt as an archive index.

   The old header was a persistent bar with seven product links and a burger:
   always on, always the same size, competing with whatever it was floating
   over. It is now an instrument:

     · REST      — a hairline: the wordmark and one status glyph. Nothing else
                   is visible until you ask.
     · OPEN      — the full chapter list. Opens on hover/focus of the bar, on
                   any interaction, and on SCROLL REVERSAL (scrolling up is
                   the universal "where am I" gesture).
     · SIGNAL    — a thin vertical line down the left edge whose marker
                   descends as you move through the archive. The active
                   chapter is a light state on that line, not a highlighted
                   word.
     · MOBILE    — a full-screen chapter sheet with large typographic labels,
                   keeping the old menu's focus trap and scroll lock.

   The chapter list is authored in lib/chapters.ts (ten chapters), NOT derived
   from the DOM: the index describes the story, and the story is authored.
   ========================================================================== */

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ArchiveIndex() {
  const { chapter, meta, step } = useChapter();
  const quality = useQuality();
  const wallet = useMockWallet();

  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  /* Read once per open, not per render: the stored chapter is a snapshot of
     the last session, and re-reading it on every render would make the
     "continue" row flicker as you move through the page. */
  const [resume, setResume] = useState<ReturnType<typeof readResume>>(null);
  const { supported: soundSupported, enabled: soundOn, toggle: toggleSound } = useInterfaceSound();
  const lastY = useRef(0);
  const barRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  /* ---- Rest / open state ---------------------------------------------------
     Two triggers: the page has moved off the top, and the visitor has
     REVERSED direction. The reversal is what makes the index feel like it is
     listening rather than like a sticky header. */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (lastY.current - y > 6) setOpen(true);
      else if (y - lastY.current > 90) setOpen(false);
      lastY.current = y;
    };
    lastY.current = window.scrollY;
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Opening the sheet locks the page through lib/scroll so Lenis freezes with
     the viewport — the same contract the old mobile menu had. */
  useEffect(() => {
    if (sheet) lockPage('menu');
    else unlockPage('menu');
    return () => unlockPage('menu');
  }, [sheet]);
  useFocusTrap(sheet, sheetRef, { onEscape: () => setSheet(false) });

  const openSheet = useCallback(() => {
    setResume(readResume());
    setSheet(true);
  }, []);

  const onBarEnter = useCallback(() => {
    if (window.matchMedia('(hover: hover)').matches) setOpen(true);
  }, []);

  const isOpen = open || scrolled;

  return (
    <>
      <header
        className="idx"
        ref={barRef}
        data-open={isOpen ? 'true' : 'false'}
        data-scrolled={scrolled ? 'true' : 'false'}
        onPointerEnter={onBarEnter}
        onFocusCapture={() => setOpen(true)}
      >
        <div className="idx__bar">
          <a className="idx__brand" href="#top" aria-label="The Nemoverse — return to the beginning">
            <img src={LOGO_SRC} alt="" width={22} height={22} />
            NEMO<b>VERSE</b>
          </a>

          {/* The chapter list. Kept in the DOM at rest (screen readers and
              keyboard users get the whole index immediately) and revealed
              visually with opacity + travel — never display:none. */}
          <nav aria-label="Archive index">
            <ul className="idx__list">
              {CHAPTER_ORDER.filter((id) => id !== 'wake').map((id) => {
                const c = CHAPTERS[id];
                const active = id === chapter;
                return (
                  <li key={id}>
                    <a
                      className="idx__chapter"
                      href={`#${CHAPTER_ANCHOR[id]}`}
                      data-active={active ? 'true' : 'false'}
                      aria-current={active ? 'true' : undefined}
                      title={c.intent}
                    >
                      <i>{c.numeral}</i>
                      {c.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="idx__right">
            <span className="idx__status" aria-hidden="true">
              {String(meta.index).padStart(2, '0')} · {meta.title}
            </span>
            <button
              type="button"
              className="idx__toggle"
              aria-expanded={sheet}
              aria-label={sheet ? 'Close the archive index' : 'Open the archive index'}
              onClick={() => (sheet ? setSheet(false) : openSheet())}
            >
              <span className="idx__toggle-glyph" aria-hidden="true" />
              INDEX
            </button>
            <span className="idx__wallet">
              <WalletButton
                connected={wallet.connected}
                onConnect={wallet.connect}
                onReset={wallet.disconnect}
                compact
              />
            </span>
          </div>
        </div>
      </header>

      {/* ---- The signal line ------------------------------------------------
         A thin vertical rail down the left edge. The marker descends it as
         the story advances: the only persistent "you are here" on the page. */}
      {quality.tier !== 'low' && (
        <nav className="idxsignal" aria-label="Chapter progress">
          <span className="idxsignal__rail" aria-hidden="true">
            <motion.i
              className="idxsignal__marker"
              aria-hidden="true"
              /* `top` is animated as a percentage of the rail, so the opening
                 frame has to be a resolvable percentage — from `auto` framer
                 has nothing to interpolate and the marker snaps. */
              initial={{ top: '0%' }}
              animate={{ top: `${(step / (CHAPTER_ORDER.length - 1)) * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
            />
          </span>
          {CHAPTER_ORDER.filter((id) => id !== 'wake').map((id) => {
            const c = CHAPTERS[id];
            return (
              <a
                key={id}
                className="idxsignal__item"
                href={`#${CHAPTER_ANCHOR[id]}`}
                data-active={id === chapter ? 'true' : 'false'}
                aria-label={`Chapter ${c.numeral} — ${c.title}`}
                aria-current={id === chapter ? 'true' : undefined}
              >
                <span className="idxsignal__num">{String(c.index).padStart(2, '0')}</span>
              </a>
            );
          })}
        </nav>
      )}

      {/* ---- The mobile sheet ---------------------------------------------- */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            className="idxsheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Archive index"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {/* Resume — only offered when the stored chapter is NOT the one
                you are already reading, which is exactly the "I reloaded and
                lost my place" case. */}
            {resume && resume !== 'wake' && isBehindResume(chapter) && (
              <motion.a
                href={`#${CHAPTER_ANCHOR[resume]}`}
                className="idxsheet__resume"
                onClick={() => setSheet(false)}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <span className="idxsheet__resume-label">CONTINUE FROM</span>
                <span className="idxsheet__resume-chapter">
                  <i>{CHAPTERS[resume].numeral}</i>
                  {CHAPTERS[resume].title}
                </span>
                <span className="idxsheet__resume-intent">{CHAPTERS[resume].intent}</span>
              </motion.a>
            )}

            {CHAPTER_ORDER.filter((id) => id !== 'wake').map((id, i) => {
              const c = CHAPTERS[id];
              return (
                <motion.a
                  key={id}
                  href={`#${CHAPTER_ANCHOR[id]}`}
                  className="idxsheet__chapter"
                  data-active={id === chapter ? 'true' : 'false'}
                  onClick={() => setSheet(false)}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.045, duration: 0.55, ease: EASE }}
                >
                  <i>{c.numeral}</i>
                  {c.title}
                </motion.a>
              );
            })}
            <div className="idxsheet__foot">
              <WalletButton
                connected={wallet.connected}
                onConnect={wallet.connect}
                onReset={wallet.disconnect}
              />
              {/* The sound switch lives here on phones, where the dock has
                  been reduced to a single button. Same hook, same state. */}
              {soundSupported && (
                <button
                  type="button"
                  className="idxsheet__sound"
                  data-on={soundOn ? 'true' : 'false'}
                  onClick={toggleSound}
                  aria-pressed={soundOn}
                >
                  SOUND {soundOn ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
            <p className="idxsheet__foot">ONE CANON · INFINITE VERSIONS</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
