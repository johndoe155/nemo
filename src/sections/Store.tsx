import { useState } from 'react';
import { Reveal, SectionHead, toast, useMockWallet } from '../components/ui';
import type { Product } from '../lib/data';
import { PRODUCTS } from '../lib/data';

function ProductCard({
  p,
  wallet,
  hero,
  delay,
}: {
  p: Product;
  wallet: { connected: boolean };
  hero?: boolean;
  delay?: number;
}) {
  const gated = p.gated && !wallet.connected;
  const [loaded, setLoaded] = useState(false);
  const onAdd = () => {
    if (gated) {
      toast('CONNECT WALLET TO UNLOCK HOLDER SKU');
      return;
    }
    toast(`${p.name} — ADDED TO CART · DEMO`);
  };
  return (
    <Reveal delay={delay} y={34} className={hero ? '' : ''}>
      <div className={`card product sheen ${hero ? 'store__hero' : ''}`}>
        <div className="product__media" style={{ position: 'relative' }}>
          {/* Image shimmer skeleton */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: 'radial-gradient(80% 70% at 50% 40%, rgba(63,232,255,0.1), transparent 72%)',
              opacity: loaded ? 0 : 1,
              transition: 'opacity 0.6s ease',
            }}
            aria-hidden="true"
          />
          <span className="badge tag" style={{ '--c': 'var(--cyan)' }}>
            {p.kind.split('·')[0].trim()}
          </span>
          {p.gated && (
            <span className="badge gated-tag" style={{ '--c': 'var(--gold)' }}>
              HOLDER SKU
            </span>
          )}
          <img
            src={p.image}
            alt={p.name}
            loading={hero ? 'eager' : 'lazy'}
            onLoad={() => setLoaded(true)}
            style={{
              opacity: loaded ? 1 : 0.25,
              transition: 'opacity 0.8s ease',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>
        {hero && <div className="scrim" />}
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
            <button
              className={`btn ${gated ? 'btn-ghost' : 'btn-primary'}`}
              onClick={onAdd}
            >
              <span className="btn-spark" />
              {gated ? 'CONNECT TO VIEW' : 'ADD TO CART'}
            </button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function Store() {
  const wallet = useMockWallet();
  const [heroProduct, ...stack] = PRODUCTS;

  return (
    <section className="section store section--tall" id="store">
      <div className="shell">
        <SectionHead
          num="05"
          kicker="05 · DIRECT SHOPIFY INTEGRATION"
          title={
            <>
              The <span className="txt-grad">storefront</span>, wired into the Nemoverse
            </>
          }
          sub={
            <>
              Featured products from the Shopify store. Holder discounts are auto-applied at
              checkout; gated SKUs unlock by trait tier; every order ships with a Proof-of-Purchase
              pull.
            </>
          }
        />

        <div className="store__mag">
          <ProductCard p={heroProduct} wallet={wallet} hero />
          <div className="store__stack">
            {stack.map((p, i) => (
              <ProductCard key={p.sku} p={p} wallet={wallet} delay={0.06 + i * 0.06} />
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
