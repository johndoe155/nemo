import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal, toast, Verified, WalletButton, useMockWallet, MOCK_ADDRESS } from '../components/ui';
import CardImage from '../components/CardImage';
import { PRODUCTS } from '../lib/data';

/* ============================================================================
   THE PRINT SHOP — beat 5 (part of Holder Economics, zone Z2)

   Was a shopify-ish card grid: a hero product card with a gradient scrim and
   a stack of glass cards, each with a glowing ADD TO CART pill.

   Now it is the order sheet of a screen-print studio, which is what the
   catalogue actually sells (numbered prints, apparel runs, an enamel pin):

     LEFT  — THE ORDER SHEET: a printed table. One row per SKU, ruled with ink,
             serial-numbered, with the format stated plainly and the price in
             tabular figures. Gated SKUs are stamped HOLDERS ONLY instead of
             carrying a glowing badge.
     RIGHT — THE PROOF: the piece being considered, presented as a proof print
             — taped corners, ink-ruled window, a caption band carrying the SKU
             and the price, and the one action that matters.

   The row under the cursor (or under keyboard focus) is the piece on the
   proof, so the sheet and the proof are one instrument. Everything else is
   unchanged: the mock wallet gates the holder SKU, the toast confirms a demo
   add, and the holder discount is stated where the price is read.
============================================================================ */

export default function Store() {
  const wallet = useMockWallet();
  const [active, setActive] = useState(0);
  const product = PRODUCTS[active] ?? PRODUCTS[0];

  const gated = (g: boolean) => g && !wallet.connected;

  const add = (name: string, isGated: boolean) => {
    if (isGated) {
      toast('CONNECT WALLET TO UNLOCK HOLDER SKU');
      return;
    }
    toast(`${name} — ADDED TO CART · DEMO`);
  };

  return (
    <div className="store shop" id="store">
      <div className="shell">
        <header className="part-head">
          <span className="part-head__kicker">DIRECT SHOPIFY INTEGRATION</span>
          <h3 className="part-head__title">
            The <span className="txt-grad">print shop</span>, wired in
          </h3>
        </header>

        <div className="shop__grid">
          {/* ------------------------------ the proof ------------------------------ */}
          <Reveal delay={0.06} blur={false} className="shop__proofwrap">
            <figure className="shop__proof" data-cursor="THE PROOF">
              <span className="tape tape--tl" aria-hidden="true" />
              <span className="tape tape--br" aria-hidden="true" />
              <div className="shop__window">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={product.sku}
                    className="shop__plate"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <CardImage
                      src={product.image}
                      alt={product.name}
                      eager
                      sizes="(min-width: 981px) min(44vw, 620px), 92vw"
                    />
                  </motion.div>
                </AnimatePresence>

                {product.gated && (
                  <span className="shop__gate" aria-hidden="true">
                    HOLDERS ONLY
                  </span>
                )}
                <span className="shop__edition" aria-hidden="true">
                  PROOF · ED. 0{active + 1}
                </span>
              </div>

              <figcaption className="shop__caption">
                <span className="shop__sku">{product.sku}</span>
                <span className="shop__name">{product.name}</span>
                <span className="shop__kind">{product.kind}</span>
                <p className="shop__note">{product.note}</p>
                <div className="shop__price-row">
                  <span className="shop__price">
                    ${product.price}
                    <em>{wallet.connected ? 'HOLDER −25%' : 'USD'}</em>
                  </span>
                  <button
                    type="button"
                    className="shop__cta"
                    onClick={() => add(product.name, product.gated)}
                    data-cursor={gated(product.gated) ? 'UNLOCK' : 'ADD'}
                  >
                    {gated(product.gated) ? 'CONNECT TO VIEW' : 'ADD TO CART'}
                  </button>
                </div>
              </figcaption>
            </figure>
          </Reveal>

          {/* ------------------------------ the order sheet ------------------------------ */}
          <Reveal delay={0.12} blur={false} className="shop__sheetwrap">
            <div className="shop__sheet">
              <header className="shop__sheet-head">
                <span>ORDER SHEET</span>
                <span>{PRODUCTS.length} SKUS · SHIPS WORLDWIDE</span>
              </header>

              <table className="shop__table">
                <caption className="vh">
                  Store catalogue — choose a row to see the piece on the proof
                </caption>
                <thead>
                  <tr>
                    <th scope="col">№</th>
                    <th scope="col">PIECE</th>
                    <th scope="col">FORMAT</th>
                    <th scope="col" className="shop__num">
                      PRICE
                    </th>
                    <th scope="col" className="shop__act">
                      <span className="vh">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTS.map((p, i) => {
                    const locked = gated(p.gated);
                    return (
                      <tr
                        key={p.sku}
                        data-active={i === active}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onClick={() => setActive(i)}
                      >
                        <th scope="row" className="shop__idx">
                          {String(i + 1).padStart(2, '0')}
                        </th>
                        <td className="shop__cell-name">
                          <b>{p.name}</b>
                          <span>{p.sku}</span>
                        </td>
                        <td className="shop__cell-kind">{p.kind}</td>
                        <td className="shop__num">
                          ${p.price}
                          {wallet.connected && <em> −25%</em>}
                        </td>
                        <td className="shop__act">
                          {locked ? (
                            <span className="shop__stamp shop__stamp--lock">HOLDERS ONLY</span>
                          ) : (
                            <button
                              type="button"
                              className="shop__stamp"
                              onClick={(e) => {
                                e.stopPropagation();
                                add(p.name, p.gated);
                              }}
                              aria-label={`Add ${p.name} to cart`}
                            >
                              ADD
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="shop__verify">
                <div className="shop__verify-copy">
                  <b>Wallet verification</b>
                  <span>
                    RainbowKit connect → on-chain ownership check via Alchemy → perks auto-applied
                    at Shopify checkout.
                  </span>
                </div>
                <div className="shop__verify-act">
                  {wallet.connected && (
                    <span className="holderline">
                      <Verified />
                      VERIFIED HOLDER · <code>{MOCK_ADDRESS}</code> · GENESIS · LEGENDARY TRAIT
                    </span>
                  )}
                  <WalletButton
                    connected={wallet.connected}
                    onConnect={wallet.connect}
                    onReset={wallet.disconnect}
                  />
                </div>
              </div>

              <p className="shop__foot">
                ◆ CHECKOUT ROUTES THROUGH SHOPIFY · DISCOUNT CODES &amp; UNLOCKS VIA
                ADMIN/STOREFRONT API · <b>DEMO CATALOG — NO REAL CHECKOUT</b>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
