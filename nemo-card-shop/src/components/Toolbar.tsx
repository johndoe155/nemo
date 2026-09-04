import { RARITY, STATUS_ORDER, STATUS_LABEL, SORT_OPTIONS, TAG_SET, type Rarity, type SortKey, type Universe } from '../lib/data';

interface FilterState {
  rarity: Rarity | 'all';
  status: Universe['status'] | 'all';
  tag: string; // '' = all
}

export default function Toolbar({
  filters,
  onChange,
  sort,
  onSort,
  query,
  onQuery,
  resultCount,
  totalCount,
  activeCount,
  onReset,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  query: string;
  onQuery: (q: string) => void;
  resultCount: number;
  totalCount: number;
  activeCount: number;
  onReset: () => void;
}) {
  const rarityOrder = Object.keys(RARITY) as Rarity[];
  const hasActive =
    filters.rarity !== 'all' || filters.status !== 'all' || filters.tag !== '' || query.trim() !== '';

  return (
    <div className="nshop-toolbar">
      <div className="nshop-toolbar__top">
        {/* Search */}
        <div className="nshop-search">
          <label className="vh" htmlFor="nshop-search">
            Search the registry
          </label>
          <svg
            className="nshop-search__icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.4-3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            id="nshop-search"
            className="nshop-search__input"
            type="search"
            placeholder="Search name, code, artist…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="nshop-search__clear"
              onClick={() => onQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="nshop-toolbar__meta">
          <span className="nshop-count" aria-live="polite">
            <b>{resultCount}</b>
            <em>/ {totalCount} UNIVERSES</em>
          </span>
          {hasActive && (
            <button type="button" className="nshop-reset" onClick={onReset}>
              RESET · {activeCount} ACTIVE
            </button>
          )}
        </div>
      </div>

      <div className="nshop-filters" role="group" aria-label="Browse filters">
        {/* Rarity */}
        <fieldset className="nshop-fgroup">
          <legend className="nshop-fgroup__label">RARITY</legend>
          <div className="nshop-fgroup__chips">
            <button
              type="button"
              className="nshop-chip"
              aria-pressed={filters.rarity === 'all'}
              onClick={() => onChange({ ...filters, rarity: 'all' })}
            >
              <span className="nshop-chip__dot" style={{ '--c': 'var(--ink-faint)' } as React.CSSProperties} />
              ALL
            </button>
            {rarityOrder.map((r) => (
              <button
                key={r}
                type="button"
                className="nshop-chip"
                aria-pressed={filters.rarity === r}
                style={{ '--c': RARITY[r].color } as React.CSSProperties}
                onClick={() => onChange({ ...filters, rarity: r })}
              >
                <span className="nshop-chip__dot" aria-hidden="true" />
                {RARITY[r].label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Status */}
        <fieldset className="nshop-fgroup">
          <legend className="nshop-fgroup__label">STATUS</legend>
          <div className="nshop-fgroup__chips">
            <button
              type="button"
              className="nshop-chip"
              aria-pressed={filters.status === 'all'}
              onClick={() => onChange({ ...filters, status: 'all' })}
            >
              <span className="nshop-chip__dot" style={{ '--c': 'var(--ink-faint)' } as React.CSSProperties} />
              ALL
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className="nshop-chip"
                aria-pressed={filters.status === s}
                style={{ '--c': 'var(--ink-faint)' } as React.CSSProperties}
                onClick={() => onChange({ ...filters, status: filters.status === s ? 'all' : s })}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="nshop-fgroup nshop-fgroup--spread">
          <div className="nshop-fgroup__selects">
            {/* Tag */}
            <label className="nshop-select">
              <span className="vh">Filter by tag</span>
              <select
                value={filters.tag}
                onChange={(e) => onChange({ ...filters, tag: e.target.value })}
              >
                <option value="">ALL TAGS</option>
                {TAG_SET.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Sort */}
            <label className="nshop-select">
              <span className="vh">Sort the catalog</span>
              <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    SORT · {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
