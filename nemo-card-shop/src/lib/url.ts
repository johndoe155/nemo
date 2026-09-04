/* Minimal History-API routing so the card detail is deep-linkable & shareable
   (survives refresh) without pulling in a router library. Selected card code
   lives in the `card` query param, e.g.  ?card=U-005 */

export function readCardCode(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('card');
}

function writeUrl(code: string | null, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('card', code);
  else url.searchParams.delete('card');
  // Keep the hash-free, query only representation.
  const target = url.pathname + url.search + url.hash;
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({ nemoShop: !!code }, '', target);
}

/** Open a card — adds a history entry so Back returns to the grid. */
export function pushCard(code: string): void {
  writeUrl(code, 'push');
}

/** Close — roll back to the grid without leaving the page on a deep link. */
export function popCard(openedLocally: boolean): void {
  if (openedLocally && window.history.state && window.history.state.nemoShop) {
    window.history.back();
  } else {
    writeUrl(null, 'replace');
  }
}
