import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HOLDER_DISCOUNT, type Universe } from '../lib/data';
import { discount, fmtEth } from '../lib/util';

export interface CartLine {
  u: Universe;
  qty: number;
}

function unitPrice(u: Universe, holder: boolean): number {
  const purchasable = u.status === 'live' || u.status === 'upcoming';
  if (holder && purchasable && u.price > 0) return discount(u.price, HOLDER_DISCOUNT);
  return u.price;
}

export default function CartDrawer({
  open,
  lines,
  holder,
  onClose,
  onSetQty,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  lines: CartLine[];
  holder: boolean;
  onClose: () => void;
  onSetQty: (u: Universe, qty: number) => void;
  onRemove: (u: Universe) => void;
  onCheckout: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('.nshop-drawer__close')?.focus();
    }, 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const total = lines.reduce((s, l) => s + unitPrice(l.u, holder) * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="nshop-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            className="nshop-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nshop-cart-title"
            initial={{ x: '104%' }}
            animate={{ x: 0 }}
            exit={{ x: '104%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          >
            <header className="nshop-drawer__head">
              <div>
                <span className="nshop-drawer__eyebrow">YOUR VAULT</span>
                <h2 className="nshop-drawer__title" id="nshop-cart-title">
                  CART
                </h2>
              </div>
              <div className="nshop-drawer__headacts">
                {itemCount > 0 && (
                  <span className="nshop-drawer__count" aria-live="polite">
                    {itemCount} {itemCount === 1 ? 'PIECE' : 'PIECES'}
                  </span>
                )}
                <button
                  type="button"
                  className="nshop-drawer__close"
                  onClick={onClose}
                  aria-label="Close cart"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className="nshop-drawer__body">
              {lines.length === 0 ? (
                <div className="nshop-drawer__empty">
                  <span className="nshop-drawer__empty-glyph" aria-hidden="true">◌</span>
                  <p>No universes secured yet.</p>
                  <p className="nshop-drawer__empty-sub">Browse the registry and add a piece.</p>
                  <button type="button" className="nshop-btn nshop-btn--ghost" onClick={onClose}>
                    BROWSE CATALOG
                  </button>
                </div>
              ) : (
                <ul className="nshop-drawer__lines">
                  {lines.map((l) => (
                    <li key={l.u.id} className="nshop-cartline">
                      <div className="nshop-cartline__art">
                        {l.u.image ? (
                          <img src={l.u.image} alt="" loading="lazy" width="56" height="75" />
                        ) : (
                          <span className="nshop-cartline__lock" aria-hidden="true">▚</span>
                        )}
                      </div>
                      <div className="nshop-cartline__info">
                        <span className="nshop-cartline__code">{l.u.code}</span>
                        <span className="nshop-cartline__name">{l.u.name}</span>
                        <span className="nshop-cartline__price">
                          {fmtEth(unitPrice(l.u, holder))}Ξ
                          {holder && l.u.price > 0 && l.u.status !== 'sold-out' && l.u.status !== 'encrypted' && l.u.status !== 'secret' && (
                            <em> −25%</em>
                          )}
                        </span>
                      </div>
                      <div className="nshop-cartline__ops">
                        <div className="nshop-qty" role="group" aria-label={`Quantity for ${l.u.code}`}>
                          <button
                            type="button"
                            onClick={() => onSetQty(l.u, l.qty - 1)}
                            aria-label={`Decrease ${l.u.code} quantity`}
                          >
                            −
                          </button>
                          <span aria-live="polite">{l.qty}</span>
                          <button
                            type="button"
                            onClick={() => onSetQty(l.u, l.qty + 1)}
                            aria-label={`Increase ${l.u.code} quantity`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="nshop-cartline__remove"
                          onClick={() => onRemove(l.u)}
                          aria-label={`Remove ${l.u.code} from cart`}
                        >
                          REMOVE
                        </button>
                      </div>
                      <div className="nshop-cartline__subtotal">
                        {fmtEth(unitPrice(l.u, holder) * l.qty)}Ξ
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="nshop-drawer__foot">
              <div className="nshop-drawer__total">
                <span>
                  EST. TOTAL{holder ? ' · HOLDER' : ''}
                </span>
                <b>{fmtEth(total)}Ξ</b>
              </div>
              <button
                type="button"
                className="nshop-btn nshop-btn--lg nshop-btn--gold nshop-drawer__checkout"
                disabled={lines.length === 0}
                onClick={onCheckout}
              >
                {lines.length === 0 ? 'CART EMPTY' : 'CHECKOUT → DEMO'}
              </button>
              <p className="nshop-drawer__disclaimer">
                Demo checkout — no real payment. {/* keep clean */}
                {holder ? ' Holder pricing applied on Base.' : ' Connect as holder for −25%.'}
              </p>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
