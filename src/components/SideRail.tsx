import { useEffect, useState } from 'react';

/* ---------------------------------------------------------------------------
   SideRail — fixed left-edge orientation mini-rail (DESIGN_AUDIT §3.1.1).
   Discovers the top-level sections at runtime, tracks the active one with an
   IntersectionObserver, and lets the user jump between them. Desktop only
   (hidden via CSS below 1100px / on coarse pointers).
--------------------------------------------------------------------------- */

interface RailItem {
  id: string;
  label: string;
}

export default function SideRail() {
  const [items, setItems] = useState<RailItem[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));
    setItems(sections.map((s) => ({ id: s.id, label: s.id.replace(/-/g, ' ').toUpperCase() })));

    if (typeof IntersectionObserver === 'undefined' || sections.length === 0) return;
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
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
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
