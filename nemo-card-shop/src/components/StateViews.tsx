import { Component, type ErrorInfo, type ReactNode } from 'react';

/* ----------------------------- Loading skeleton ----------------------------- */

const SKELETON_COUNT = 9;

export function SkeletonCard() {
  return (
    <div className="nshop-skel" aria-hidden="true">
      <div className="nshop-skel__media" />
      <div className="nshop-skel__body">
        <span className="nshop-skel__line nshop-skel__line--w60" />
        <span className="nshop-skel__line nshop-skel__line--w40" />
        <span className="nshop-skel__line nshop-skel__line--w80" />
      </div>
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="nshop-grid" role="status" aria-label="Loading the catalog">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="vh">Loading cards…</span>
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------- */

export function EmptyState({
  onClear,
  label,
}: {
  onClear: () => void;
  label?: string;
}) {
  return (
    <div className="nshop-empty" role="status">
      <div className="nshop-empty__glyph" aria-hidden="true">
        <span>∅</span>
      </div>
      <h3 className="nshop-empty__title">No universes match</h3>
      <p className="nshop-empty__body">
        {label ?? 'No card in the registry fits that filter and search combination.'}
      </p>
      <button type="button" className="nshop-btn nshop-btn--ghost" onClick={onClear}>
        CLEAR ALL FILTERS
      </button>
    </div>
  );
}

/* ------------------------------ Error boundary ------------------------------ */

interface EBProps {
  children: ReactNode;
  onRetry?: () => void;
}
interface EBState {
  error: Error | null;
}

/** Boundary around the catalog grid: one bad card can't blank the whole shop. */
export class CatalogBoundary extends Component<EBProps, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the console clean but visible for debugging in a dev context.
    if (import.meta.env.DEV) console.error('[card-shop] catalog error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="nshop-empty nshop-empty--error" role="alert">
          <div className="nshop-empty__glyph" aria-hidden="true">
            <span>⚠</span>
          </div>
          <h3 className="nshop-empty__title">The registry glitched</h3>
          <p className="nshop-empty__body">
            A card failed to render and the grid was isolated. The rest of the shop is unaffected.
          </p>
          <button
            type="button"
            className="nshop-btn nshop-btn--primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
            }}
          >
            RETRY RENDER
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
