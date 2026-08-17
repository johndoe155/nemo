import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Universe } from '../lib/data';
import { RARITY } from '../lib/data';

const EASE = [0.16, 1, 0.3, 1] as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function UniverseDialog({ u, onClose }: { u: Universe; onClose: () => void }) {
  const rarity = RARITY[u.rarity];
  const accent = rarity.color;
  const soldPct = u.supply ? Math.round((u.minted / u.supply) * 100) : 0;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      panel.setAttribute('tabindex', '-1');
      panel.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      className="dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${u.code} — ${u.name}`}
    >
      <motion.div
        ref={panelRef}
        className="dialog"
        style={{ '--card-accent': accent }}
        initial={{ opacity: 0, y: 44, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ duration: 0.5, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="dialog__close" onClick={onClose} aria-label="Close universe detail">
          ✕
        </button>

        <div className="dialog__grid">
          <div className="dialog__media">
            {u.image ? (
              <img src={u.image} alt={`${u.name} — ${u.artist.name}`} />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background:
                    'radial-gradient(60% 50% at 50% 45%, rgba(138,77,255,0.18), transparent 70%)',
                }}
              >
                <div className="ucard__lock" style={{ textAlign: 'center' }}>
                  <div className="ring orbit spin" style={{ width: 90, height: 90, margin: '0 auto 1.2rem' }} />
                  <div className="q" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', color: 'var(--ink-dim)', letterSpacing: '0.3em' }}>
                    ▚▚▚
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', letterSpacing: '0.26em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginTop: '0.8rem' }}>
                    ART & LORE SEALED UNTIL DROP
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="dialog__body">
            <div className="dialog__code">{u.code} · CANON ENTRY</div>
            <h3 className="dialog__name">{u.name}</h3>
            <p className="dialog__world">TIMELINE — {u.world}</p>

            <p className="dialog__lore">{u.lore}</p>

            <div className="dialog__specs">
              <div className="dialog__spec">
                <span>RARITY</span>
                <b style={{ color: accent }}>{rarity.label}</b>
              </div>
              <div className="dialog__spec">
                <span>EDITION</span>
                <b>
                  {u.minted}/{u.supply}
                </b>
              </div>
              <div className="dialog__spec">
                <span>MINT PRICE</span>
                <b className="eth">{u.price > 0 ? `${u.price} ETH · BASE` : '—'}</b>
              </div>
              <div className="dialog__spec">
                <span>RELEASED</span>
                <b>
                  {u.status === 'secret'
                    ? 'UNREGISTERED'
                    : new Date(u.released).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })}
                </b>
              </div>
            </div>

            {u.variant && (
              <p className="dialog__split">
                <span className="pill">VARIANT PULLS</span> {u.variant}
              </p>
            )}

            <div className="dialog__artist">
              <span className="ava" style={{ '--a1': u.artist.hue[0], '--a2': u.artist.hue[1] }}>
                {u.artist.initials}
              </span>
              <span className="who">
                <b>{u.artist.name}</b>
                <span>{u.artist.handle} · {u.style}</span>
              </span>
              <span className="quote">{u.artist.quote}</span>
            </div>

            <p className="dialog__split">
              <span className="pill">
                REVENUE SPLIT <b>60% ARTIST</b>
              </span>
              <span className="pill">
                <b>40% CLIENT</b>
              </span>
              <span className="pill">CREDITED IN METADATA</span>
            </p>

            {u.status === 'live' && (
              <div>
                <div className="labels" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 6 }}>
                  <span>CLAIMED</span>
                  <span>{soldPct}%</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${soldPct}%` }} />
                </div>
              </div>
            )}

            <div className="dialog__ctas">
              {u.status === 'live' && (
                <a href="#perks" className="btn btn-primary" onClick={onClose}>
                  <span className="btn-spark" />
                  CLAIM THIS UNIVERSE
                </a>
              )}
              {u.status === 'upcoming' && (
                <a href="#perks" className="btn btn-primary" onClick={onClose}>
                  <span className="btn-spark" />
                  HOLDERS ENTER FIRST
                </a>
              )}
              {u.status === 'sold-out' && (
                <span className="btn btn-ghost" style={{ cursor: 'default' }}>
                  SOLD OUT — CHECK SECONDARY
                </span>
              )}
              {u.status === 'encrypted' && (
                <a href="#persona" className="btn btn-gold" onClick={onClose}>
                  ASK THE PERSONA ABOUT #008
                </a>
              )}
              {u.status === 'secret' && (
                <a href="#pulls" className="btn btn-gold" onClick={onClose}>
                  NO ONE COMMISSIONED THIS
                </a>
              )}
              <a href="#pulls" className="btn btn-ghost" onClick={onClose}>
                HOW PULLS WORK ▸
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
