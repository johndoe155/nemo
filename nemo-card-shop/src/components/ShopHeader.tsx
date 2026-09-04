import { MOCK_ADDRESS } from '../lib/wallet';

export default function ShopHeader({
  holder,
  onToggleWallet,
  cartCount,
  onOpenCart,
}: {
  holder: boolean;
  onToggleWallet: () => void;
  cartCount: number;
  onOpenCart: () => void;
}) {
  return (
    <header className="nshop-header">
      <a className="nshop-brand" href="#nshop-catalog" onClick={(e) => e.preventDefault()}>
        <span className="nshop-brand__mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="nshop-brand__text">
          <strong>NEMOVERSE</strong>
          <em>CARD SHOP</em>
        </span>
      </a>

      <div className="nshop-header__acts">
        <button
          type="button"
          className={`nshop-btn nshop-btn--ghost nshop-wallet ${holder ? 'is-connected' : ''}`}
          onClick={onToggleWallet}
          aria-pressed={holder}
        >
          {holder ? (
            <>
              <span className="nshop-pulse" aria-hidden="true" />
              <span className="nshop-wallet__txt">
                {MOCK_ADDRESS}
                <em>HOLDER</em>
              </span>
            </>
          ) : (
            <span className="nshop-wallet__txt">
              CONNECT WALLET<em className="nshop-wallet__d2">DEMO</em>
            </span>
          )}
        </button>

        <button
          type="button"
          className="nshop-btn nshop-btn--ghost nshop-cartbtn"
          onClick={onOpenCart}
          aria-label={`Open cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16l-1.4 11.1a2 2 0 0 1-2 1.9H7.4a2 2 0 0 1-2-1.9L4 7Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M8.5 9V6.5a3.5 3.5 0 1 1 7 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="nshop-cartbtn__count" aria-hidden="true">
            {cartCount}
          </span>
        </button>
      </div>
    </header>
  );
}
