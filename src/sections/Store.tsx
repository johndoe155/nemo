import { Reveal, SectionHead, useMockWallet } from '../components/ui';
import { PRODUCTS } from '../lib/data';

export default function Store() {
  const wallet = useMockWallet();

  return (
    <section className="section store" id="store">
      <div className="shell">
        <SectionHead
          kicker="05 · DIRECT SHOPIFY INTEGRATION"
          title={
            <>
              The <span className="txt-grad">storefront</span>, wired into the Multiverse
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

        <div className="store__grid">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.sku} delay={i * 0.08} y={34}>
              <div className="card product sheen">
                <div className="product__media">
                  <span className="badge tag" style={{ '--c': 'var(--cyan)' }}>
                    {p.kind.split('·')[0].trim()}
                  </span>
                  {p.gated && (
                    <span className="badge gated-tag" style={{ '--c': 'var(--gold)' }}>
                      HOLDER SKU
                    </span>
                  )}
                  <img src={p.image} alt={p.name} loading="lazy" />
                </div>
                <span className="product__sku">{p.sku}</span>
                <h3 className="product__name">{p.name}</h3>
                <span className="product__kind">{p.kind}</span>
                <p className="product__note">{p.note}</p>
                <div className="product__row">
                  <span className="product__price">
                    ${p.price}
                    <span className="eth">{wallet.connected ? 'HOLDER −25%' : 'USD'}</span>
                  </span>
                  <button className={`btn ${p.gated && !wallet.connected ? 'btn-ghost' : 'btn-primary'}`}>
                    <span className="btn-spark" />
                    {p.gated && !wallet.connected ? 'CONNECT TO VIEW' : 'ADD TO CART'}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
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
