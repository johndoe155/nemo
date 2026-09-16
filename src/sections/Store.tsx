import { motion } from 'framer-motion';

import { RevealArt, RevealLine, RevealMeta, RevealPlate, RevealText } from '../components/reveal';
import { Reveal, SectionHead, toast, useMockWallet } from '../components/ui';
import { KineticButton } from '../components/motion';
import CardImage from '../components/CardImage';
import type { Product } from '../lib/data';
import { PRODUCTS } from '../lib/data';

/* ============================================================================
   06 · COMMERCE — the artifact catalog

   The store was a generic ecommerce grid: one hero card and a stack of
   identically-framed product cards, each with a badge, a SKU, a name, a kind,
   a price and a button, all at the same weight.

   It is now an artifact catalog:

     · ONE editorial hero artifact — full-bleed art, the caption printed over
       it, and the note set as an annotation rather than as a feature bullet
     · the remaining products are CATALOGUE PLATES: unequal weight, a small
       thumbnail, and the information arranged as annotation around the object
       instead of a stack of fields
     · price and holder state stay obvious — they are the two things a visitor
       actually comes here to read

   Nothing about the wallet, the gating, the pricing or the cart behaviour
   changed. Only the presentation.
   ========================================================================== */

function PlateRow({ p, wallet, i }: { p: Product; wallet: { connected: boolean }; i: number }) {
  const gated = p.gated && !wallet.connected;
  const onAdd = () => {
    if (gated) {
      toast('CONNECT WALLET TO UNLOCK HOLDER SKU');
      return;
    }
    toast(`${p.name} — ADDED TO CART · DEMO`);
  };

  return (
    <RevealPlate at={i * 0.12} y={26}>
      <div className="plate-row">
        <div className="plate-row__thumb">
          <CardImage
            src={p.image}
            alt={p.name}
            sizes="110px"
            onLoaded={(img) => {
              img.style.opacity = '1';
            }}
          />
        </div>
        <div className="plate-row__body">
          <span className="plate-row__kind">
            {p.sku} · {p.kind.split('·')[0].trim()}
          </span>
          <h3 className="plate-row__name">{p.name}</h3>
          <div className="plate-row__foot">
            <span className="plate-row__price">
              ${p.price}
              <em>{wallet.connected ? 'HOLDER −25%' : 'USD'}</em>
            </span>
            <KineticButton
              className="btn btn-ghost"
              label={gated ? 'CONNECT TO VIEW' : 'ADD TO CART'}
              swap={gated ? 'UNLOCK THE SKU' : 'SECURE THE PIECE'}
              spark={false}
              cursor={gated ? 'UNLOCK' : 'ADD'}
              onClick={onAdd}
            />
          </div>
        </div>
      </div>
    </RevealPlate>
  );
}

export default function Store() {
  const wallet = useMockWallet();
  const [heroProduct, ...stack] = PRODUCTS;
  const gated = heroProduct.gated && !wallet.connected;

  const onHeroAdd = () => {
    if (gated) {
      toast('CONNECT WALLET TO UNLOCK HOLDER SKU');
      return;
    }
    toast(`${heroProduct.name} — ADDED TO CART · DEMO`);
  };

  return (
    <section className="section store section--tall" id="store">
      <div className="shell">
        <SectionHead
          num="06"
          kicker="06 · COMMERCE — DIRECT SHOPIFY INTEGRATION"
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

        <div className="catalog">
          {/* ---- The editorial hero artifact ---- */}
          <motion.figure
            className="catalog__hero"
            initial={{ opacity: 0, scale: 0.985 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <RevealArt className="catalog__hero-media" from="bottom">
              <CardImage
                src={heroProduct.image}
                alt={heroProduct.name}
                eager
                sizes="(min-width: 1080px) min(56vw, 880px), 92vw"
                fetchpriority="high"
              />
            </RevealArt>

            <figcaption className="catalog__caption">
              <RevealLine at={0.2} className="catalog__sku">
                {heroProduct.sku} · {heroProduct.kind}
              </RevealLine>
              <RevealText at={0.3} className="catalog__name">
                {heroProduct.name}
              </RevealText>
              <RevealMeta at={0.5}>
                <p className="catalog__note">{heroProduct.note}</p>
              </RevealMeta>
              <RevealMeta at={0.62}>
                <div className="catalog__hero-foot">
                  <span className="catalog__price">
                    ${heroProduct.price}
                    <em>{wallet.connected ? 'HOLDER −25%' : 'USD'}</em>
                  </span>
                  <KineticButton
                    className="btn btn-primary"
                    label={gated ? 'CONNECT TO VIEW' : 'ADD TO CART'}
                    swap={gated ? 'UNLOCK THE SKU' : 'SECURE THE PIECE'}
                    cursor={gated ? 'UNLOCK' : 'ADD'}
                    onClick={onHeroAdd}
                  />
                </div>
              </RevealMeta>
            </figcaption>
          </motion.figure>

          {/* ---- The catalogue plates ---- */}
          <div className="catalog__stack">
            {stack.map((p, i) => (
              <PlateRow key={p.sku} p={p} wallet={wallet} i={i} />
            ))}
          </div>
        </div>

        <Reveal delay={0.1}>
          <p className="store__foot">
            ◆ CHECKOUT ROUTES THROUGH SHOPIFY · DISCOUNT CODES &amp; UNLOCKS VIA ADMIN/STOREFRONT
            API · <b>DEMO CATALOG — NO REAL CHECKOUT</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
