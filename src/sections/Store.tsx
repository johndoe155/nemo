import { motion } from 'framer-motion';
import { Reveal, toast, useMockWallet } from '../components/ui';
import { KineticButton, useTilt } from '../components/motion';
import CardImage from '../components/CardImage';
import type { Product } from '../lib/data';
import { PRODUCTS } from '../lib/data';

function ProductCard({
  p,
  wallet,
  hero,
  delay,
  index,
}: {
  p: Product;
  wallet: { connected: boolean };
  hero?: boolean;
  delay?: number;
  index: number;
}) {
  const gated = p.gated && !wallet.connected;
  const tilt = useTilt<HTMLDivElement>({ maxDeg: hero ? 1.6 : 2.2, lift: hero ? -5 : -7 });
  const onAdd = () => {
    if (gated) {
      toast('CONNECT WALLET TO UNLOCK HOLDER SKU');
      return;
    }
    toast(`${p.name} — ADDED TO CART · DEMO`);
  };
  return (
    <Reveal delay={delay} y={34} blur={false}>
      <motion.article
        ref={tilt.ref}
        className={`card product sheen ${hero ? 'store__hero' : ''}`}
        style={tilt.style}
        {...tilt.handlers}
        data-catalog-index={String(index + 1).padStart(2, '0')}
      >
        <div className="product__catalog-mark" aria-hidden="true">
          <span>PLATE {String(index + 1).padStart(2, '0')}</span><i />
        </div>
        {/* NB: no inline `position` here. The stylesheet owns it —
            `.product__media` is `relative` for the stacked cards and
            `.store__hero .product__media` flips it to `absolute; inset: 0`
            so the hero art bleeds to the card edge. An inline
            `position: relative` used to sit on this element and silently
            beat the hero rule, collapsing the media box to 0×0 and leaving
            the featured product as a bare gradient. */}
        <div className="product__media">
          {/* Image shimmer skeleton — retired via DOM when the bitmap lands */}
          <div
            className="product-skeleton"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: 'radial-gradient(80% 70% at 50% 40%, rgba(63,232,255,0.1), transparent 72%)',
              transition: 'opacity 0.6s ease',
            }}
            aria-hidden="true"
          />
          {/* A gated SKU's kind already reads "HOLDER-EXCLUSIVE SKU", so the
              cyan kind badge would print the same fact twice — and at phone
              widths the two badges collide on their shared 10px row. The
              gated chip wins the corner it needs. */}
          {p.gated ? (
            <span className="badge gated-tag" style={{ '--c': 'var(--gold)' }}>
              HOLDER SKU
            </span>
          ) : (
            <span className="badge tag" style={{ '--c': 'var(--cyan)' }}>
              {p.kind.split('·')[0].trim()}
            </span>
          )}
          <CardImage
            src={p.image}
            alt={p.name}
            eager={hero}
            sizes={hero ? '(min-width: 981px) min(56vw, 880px), 92vw' : '(min-width: 981px) min(31vw, 470px), 92vw'}
            fetchpriority={hero ? 'high' : 'auto'}
            onLoaded={(img) => {
              const sk = img.closest('.product__media')?.querySelector<HTMLElement>('.product-skeleton');
              if (sk) sk.style.opacity = '0';
            }}
          />
        </div>
        {/* NB: no `.scrim` element here — the hero's legibility comes from
            `.store__hero::after` in overhaul.css, which owns the gradient and
            can never fall out of sync with the copy sitting on it. The bare
            `<div className="scrim" />` that used to sit here had no rule
            anywhere (only `.ucard__media .scrim` exists) and rendered as an
            empty flex child. */}
        <div className="store__body">
          <span className="product__sku">{p.sku}</span>
          <h3 className="product__name">{p.name}</h3>
          <span className="product__kind">{p.kind}</span>
          {hero && <p className="product__note">{p.note}</p>}
          <div className="product__row">
            <span className="product__price">
              ${p.price}
              <span className="eth">{wallet.connected ? 'HOLDER −25%' : 'USD'}</span>
            </span>
            {gated ? (
              <KineticButton
                className="btn btn-ghost"
                label="CONNECT TO VIEW"
                arrow
                spark={false}
                cursor="UNLOCK"
                onClick={onAdd}
              />
            ) : (
              <KineticButton
                className="btn btn-primary"
                label="ADD TO CART"
                swap="SECURE THE PIECE"
                cursor="ADD"
                onClick={onAdd}
              />
            )}
          </div>
        </div>
      </motion.article>
    </Reveal>
  );
}

export default function Store() {
  const wallet = useMockWallet();
  const [heroProduct, ...stack] = PRODUCTS;

  return (
    <section className="section store section--tall" id="store">
      <div className="shell">
        <header className="store__head">
          <div>
            <span className="kicker">VI · EDITORIAL CATALOG</span>
            <h2>Objects from<br /><em>impossible places.</em></h2>
          </div>
          <div className="store__head-note">
            <span>CATALOG / 2026–01</span>
            <p>
              Wearable evidence, numbered prints and holder-only objects. Each order leaves
              the catalog carrying one Proof-of-Purchase fragment.
            </p>
          </div>
        </header>

        <div className="store__mag">
          <ProductCard p={heroProduct} wallet={wallet} hero index={0} />
          <div className="store__stack">
            {stack.map((p, i) => (
              <ProductCard key={p.sku} p={p} wallet={wallet} delay={0.06 + i * 0.06} index={i + 1} />
            ))}
          </div>
        </div>

        <Reveal delay={0.1}>
          <p className="store__foot">
            ◆ CHECKOUT ROUTES THROUGH SHOPIFY · DISCOUNT CODES & UNLOCKS VIA ADMIN/STOREFRONT API ·{' '}
            <b>DEMO CATALOG — NO REAL CHECKOUT</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
