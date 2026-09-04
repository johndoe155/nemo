import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import '@fontsource-variable/space-grotesk';

import { CATALOG, HOLDER_DISCOUNT, RARITY, sortCatalog, type Rarity, type SortKey, type Universe } from './lib/data';
import { useStoredState, useDebounced } from './lib/util';
import { useWallet } from './lib/wallet';
import { pushCard, popCard, readCardCode } from './lib/url';

import CardCard from './components/CardCard';
import CardImage from './components/CardImage';
import ShopHeader from './components/ShopHeader';
import Toolbar from './components/Toolbar';
import DetailDialog from './components/DetailDialog';
import CartDrawer, { type CartLine } from './components/CartDrawer';
import { ToastHost, toast } from './components/Toast';
import { CatalogBoundary, CardGridSkeleton, EmptyState } from './components/StateViews';
import './styles/shop.css';

type RarityFilter = Rarity | 'all';
type StatusFilter = Universe['status'] | 'all';

function remaining(u: Universe): number {
  if (u.status === 'sold-out' || u.status === 'encrypted' || u.status === 'secret') return 0;
  return Math.max(1, u.supply - u.minted);
}

const UPCOMING = CATALOG.find((u) => u.status === 'upcoming');
const LIVE_COUNT = CATALOG.filter((u) => u.status === 'live').length;

export default function CardShop() {
  const wallet = useWallet();
  const holder = wallet.connected;

  const [loaded, setLoaded] = useState(false);
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<SortKey>('code');
  const [query, setQuery] = useState('');
  const debouncedQ = useDebounced(query, 180);

  const [cart, setCart] = useStoredState<Record<string, number>>('nemo-shop-cart', {});
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(() => readCardCode());
  const focusReturn = useRef<HTMLElement | null>(null);

  // Simulated catalog load so the skeleton path is real, not a dead branch.
  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 620);
    return () => window.clearTimeout(t);
  }, []);

  // Deep-link reconciliation: Back/Forward keeps the modal in sync.
  const openedLocally = useRef(false);
  useEffect(() => {
    const onPop = () => setSelectedCode(readCardCode());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Body scroll lock while a modal/drawer is open.
  const anyOverlay = cartOpen || !!selectedCode;
  useEffect(() => {
    if (!anyOverlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOverlay]);

  const activeCount = (rarity !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (tag ? 1 : 0) + (query.trim() ? 1 : 0);

  const visible = useMemo(() => {
    let list = CATALOG;
    if (rarity !== 'all') list = list.filter((u) => u.rarity === rarity);
    if (status !== 'all') list = list.filter((u) => u.status === status);
    if (tag) list = list.filter((u) => u.tags.includes(tag));
    const q = debouncedQ.trim().toLowerCase();
    if (q) {
      const hay = (u: Universe) =>
        `${u.name} ${u.code} ${u.world} ${u.artist.name} ${u.artist.handle} ${u.style} ${u.rarity} ${u.status}`.toLowerCase();
      list = list.filter((u) => hay(u).includes(q));
    }
    return sortCatalog(list, sort);
  }, [rarity, status, tag, debouncedQ, sort]);

  const selected = useMemo(
    () => CATALOG.find((u) => u.code === selectedCode) ?? null,
    [selectedCode],
  );

  const cartLines: CartLine[] = useMemo(
    () =>
      CATALOG.filter((u) => cart[u.code] > 0)
        .sort((a, b) => a.id - b.id)
        .map((u) => ({ u, qty: cart[u.code] })),
    [cart],
  );
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  /* ------------------------------ actions ------------------------------ */

  const openCard = (u: Universe) => {
    openedLocally.current = true;
    if (document.activeElement instanceof HTMLElement) focusReturn.current = document.activeElement;
    setSelectedCode(u.code);
    pushCard(u.code);
  };

  const closeDialog = () => {
    popCard(openedLocally.current);
    openedLocally.current = false;
    setSelectedCode(null);
    // Return focus to the card that opened the dialog, after exit animation.
    const el = focusReturn.current;
    focusReturn.current = null;
    if (el && document.contains(el)) {
      window.setTimeout(() => el.focus(), 340);
    }
  };

  const addToCart = (u: Universe, qty = 1) => {
    const cur = cart[u.code] ?? 0;
    const room = remaining(u);
    if (cur + qty > Math.min(room, 24)) {
      toast(`MAX SECURED FOR ${u.code}`, 'gold');
      return;
    }
    setCart((p) => ({ ...p, [u.code]: (p[u.code] ?? 0) + qty }));
    toast(`${u.code} — ${u.name.toUpperCase()} ADDED`, 'cyan');
  };

  const handleQuickAdd = (u: Universe) => {
    const live = u.status === 'live';
    if (u.status === 'upcoming') {
      if (holder) addToCart(u);
      else toast('CONNECT AS HOLDER TO CLAIM EARLY', 'rose');
      return;
    }
    if (live) {
      addToCart(u);
      return;
    }
    toast(`${u.code} IS ${u.status.toUpperCase().replace('-', ' ')}`, 'gold');
  };

  const setQty = (u: Universe, qty: number) => {
    if (qty <= 0) {
      setCart((p) => {
        const c = { ...p };
        delete c[u.code];
        return c;
      });
      return;
    }
    const maxQ = Math.min(remaining(u), 24);
    const next = Math.min(qty, maxQ);
    setCart((p) => ({ ...p, [u.code]: next }));
  };

  const removeLine = (u: Universe) => setQty(u, 0);

  const toggleWallet = () => {
    if (holder) {
      wallet.disconnect();
      toast('SESSION ENDED · WALLET DISCONNECTED', 'gold');
    } else {
      wallet.connect();
      toast('HOLDER VERIFIED · −25% PRICING ACTIVE', 'cyan');
    }
  };

  const resetFilters = () => {
    setRarity('all');
    setStatus('all');
    setTag('');
    setQuery('');
    setSort('code');
  };

  const checkout = () => {
    toast('DEMO CHECKOUT — NO REAL PAYMENT · THANK YOU', 'gold');
    setCartOpen(false);
    setCart({});
  };

  /* ------------------------------ render ------------------------------ */

  const liveCards = CATALOG.filter((u) => u.status === 'live').slice(0, 3);

  return (
    <MotionConfig reducedMotion="user">
    <div className="nemo-shop">
      <a className="nshop-skiplink" href="#nshop-catalog">
        Skip to catalog
      </a>

      <ToastHost />

      <ShopHeader
        holder={holder}
        onToggleWallet={toggleWallet}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
      />

      <main id="nshop-main" className="nshop-main">
        {/* Masthead */}
        <section className="nshop-masthead">
          <div className="nshop-shell">
            <div className="nshop-masthead__inner">
              <p className="nshop-eyebrow">
                <span className="nshop-eyebrow__tick" aria-hidden="true" />
                ACQUIRE THE UNIVERSES
              </p>
              <h1 className="nshop-masthead__title">
                The numbered
                <br />
                <span className="nshop-txtgrad">universe</span> cards
              </h1>
              <p className="nshop-masthead__lede">
                Limited artist-commissioned runs of NEMO, minted on Base. Browse the registry,
                filter by rarity, and secure the pieces that call to you.
              </p>

              <div className="nshop-stats" aria-label="Catalog snapshot">
                <div className="nshop-stat">
                  <b>{CATALOG.length}</b>
                  <span>REGISTERED</span>
                </div>
                <div className="nshop-stat">
                  <b>{LIVE_COUNT}</b>
                  <span>LIVE NOW</span>
                </div>
                <div className="nshop-stat">
                  <b>{UPCOMING ? '1' : '0'}</b>
                  <span>NEXT DROP</span>
                </div>
                <div className="nshop-stat">
                  <b>{holder ? '−25%' : 'MOCK'}</b>
                  <span>{holder ? 'HOLDER PRICING' : 'WALLET SESSION'}</span>
                </div>
              </div>

              {holder && (
                <div className="nshop-holderbanner" role="status">
                  <span className="nshop-pulse" aria-hidden="true" />
                  VERIFIED HOLDER — {wallet.address ?? ''} · −{Math.round(HOLDER_DISCOUNT * 100)}%
                  on every live piece
                </div>
              )}
            </div>
          </div>

          {liveCards.length > 0 && (
            <div className="nshop-masthead__art" aria-hidden="true">
              {liveCards.map((u, i) => (
                <div
                  key={u.id}
                  className={`nshop-masthead__tile nshop-masthead__tile--${i + 1}`}
                  style={{ '--a': RARITY[u.rarity].color } as React.CSSProperties}
                >
                  <CardImage src={u.image} alt="" sizes="220px" eager={i === 0} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Catalog */}
        <section id="nshop-catalog" className="nshop-catalog" aria-label="Universe catalog">
          <div className="nshop-shell">
            <Toolbar
              filters={{ rarity, status, tag }}
              onChange={(f) => {
                setRarity(f.rarity);
                setStatus(f.status);
                setTag(f.tag);
              }}
              sort={sort}
              onSort={setSort}
              query={query}
              onQuery={setQuery}
              resultCount={loaded ? visible.length : CATALOG.length}
              totalCount={CATALOG.length}
              activeCount={activeCount}
              onReset={resetFilters}
            />

            <CatalogBoundary onRetry={resetFilters}>
              {!loaded ? (
                <CardGridSkeleton />
              ) : visible.length === 0 ? (
                <EmptyState onClear={resetFilters} />
              ) : (
                <div className="nshop-grid">
                  <AnimatePresence mode="popLayout">
                    {visible.map((u, i) => (
                      <CardCard
                        key={u.code}
                        u={u}
                        index={i}
                        holder={holder}
                        onOpen={openCard}
                        onQuickAdd={handleQuickAdd}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CatalogBoundary>
          </div>
        </section>
      </main>

      <footer className="nshop-footer">
        <div className="nshop-shell">
          <p className="nshop-footer__brand">NEMOVERSE — CARD SHOP</p>
          <p className="nshop-footer__note">
            Demo storefront · mock wallet · no real payment. Reuses Nemoverse canon
            (U-001…U-009). Integration is a future, separate step.
          </p>
        </div>
      </footer>

      <DetailDialog u={selected} holder={holder} onClose={closeDialog} onAdd={(u) => addToCart(u)} />

      <CartDrawer
        open={cartOpen}
        lines={cartLines}
        holder={holder}
        onClose={() => setCartOpen(false)}
        onSetQty={setQty}
        onRemove={removeLine}
        onCheckout={checkout}
      />
    </div>
    </MotionConfig>
  );
}
