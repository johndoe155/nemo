import { useEffect, useState } from 'react';

/* ---------------------------------------------------------------------------
   SideRail — fixed left-edge orientation mini-rail (DESIGN_AUDIT §3.1.1).
   Discovers the top-level sections at runtime, tracks the active one with an
   IntersectionObserver, and lets the user jump between them. Desktop only
   (hidden via CSS below 1100px / on coarse pointers).

   MOBILE SINGULARITY REMOVAL — the singularity section does not exist on
   mobile (see sections/Singularity.tsx + styles/blackhole.css). This rail
   filters it out when the mobile breakpoint matches, and re-discovers on
   breakpoint changes so a desktop→mobile resize drops the dot immediately.
--------------------------------------------------------------------------- */

interface RailItem {
  id: string;
  label: string;
}

const MOBILE_QUERY = '(max-width: 768px)';

export default function SideRail() {
  const [items, setItems] = useState<RailItem[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);

    const discover = () => {
      const isMobile = mql.matches;
      const all = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));
      const filtered = isMobile ? all.filter((s) => s.id !== 'singularity') : all;
      setItems(filtered.map((s) => ({ id: s.id, label: s.id.replace(/-/g, ' ').toUpperCase() })));

      if (typeof IntersectionObserver === 'undefined' || filtered.length === 0) return;

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              setActive(e.target.id);
              return;
            }
          }
        },
        { rootMargin: '-38% 0px -56% 0px' },
      );
      filtered.forEach((s) => io.observe(s));
      return () => io.disconnect();
    };

    let cleanup: (() => void) | undefined = discover();

    const onChange = () => {
      cleanup?.();
      cleanup = discover();
    };

    mql.addEventListener('change', onChange);

    return () => {
      mql.removeEventListener('change', onChange);
      cleanup?.();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className="siderail" aria-label="Section progress">
      {items.map((it, i) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className={`siderail__dot ${active === it.id ? 'active' : ''}`}
          aria-current={active === it.id ? 'true' : undefined}
        >
          <i aria-hidden="true" />
          <span className="siderail__label">
            {String(i + 1).padStart(2, '0')} · {it.label}
          </span>
        </a>
      ))}
    </nav>
  );
}
