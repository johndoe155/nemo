import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import SoundToggle from './SoundToggle';

interface RailItem {
  id: string;
  chapter: string;
  label: string;
}

const CHAPTERS: Record<string, Omit<RailItem, 'id'>> = {
  nemoverse: { chapter: 'I', label: 'ARCHIVE' },
  rotunda: { chapter: 'II', label: 'ROTUNDA' },
  persona: { chapter: 'III', label: 'VOICE' },
  perks: { chapter: 'IV', label: 'ACCESS' },
  pulls: { chapter: 'V', label: 'RITUAL' },
  store: { chapter: 'VI', label: 'ARTIFACTS' },
  artists: { chapter: 'VII', label: 'AUTHORSHIP' },
  lore: { chapter: 'VIII', label: 'CANON' },
  singularity: { chapter: 'IX', label: 'COLLAPSE' },
};

const MOBILE_QUERY = '(max-width: 900px)';

/**
 * ArchiveConsole consolidates the old side dots, sound island and cursor hint
 * into one instrument. It is intentionally quiet: one active chapter name,
 * one meridian and compact ticks. Labels reveal only when the index is used.
 */
export default function SideRail() {
  const [items, setItems] = useState<RailItem[]>([]);
  const [active, setActive] = useState('nemoverse');

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    let observer: IntersectionObserver | null = null;

    const discover = () => {
      observer?.disconnect();
      const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'))
        .filter((section) => CHAPTERS[section.id])
        .filter((section) => !(mql.matches && section.id === 'singularity'));
      setItems(sections.map((section) => ({ id: section.id, ...CHAPTERS[section.id] })));

      if (typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible) setActive(visible.target.id);
        },
        { rootMargin: '-34% 0px -55% 0px', threshold: [0, 0.05, 0.2] },
      );
      sections.forEach((section) => observer?.observe(section));
    };

    discover();
    mql.addEventListener('change', discover);
    return () => {
      mql.removeEventListener('change', discover);
      observer?.disconnect();
    };
  }, []);

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === active));
  const activeItem = items[activeIndex];
  if (items.length === 0) return null;

  return (
    <aside className="archive-console" aria-label="Archive controls">
      <div className="archive-console__readout" aria-live="polite">
        <span>{activeItem?.chapter ?? 'I'}</span>
        <b>{activeItem?.label ?? 'ARCHIVE'}</b>
      </div>

      <nav className="siderail" aria-label="Chapter index">
        <span className="siderail__track" aria-hidden="true">
          <motion.i
            animate={{ scaleY: items.length > 1 ? activeIndex / (items.length - 1) : 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          />
        </span>
        {items.map((item, index) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`siderail__dot ${active === item.id ? 'active' : ''}`}
            aria-current={active === item.id ? 'true' : undefined}
            aria-label={`${item.chapter}. ${item.label}`}
          >
            <i aria-hidden="true">
              {active === item.id && (
                <motion.span
                  layoutId="siderail-marker"
                  className="siderail__marker"
                  transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.7 }}
                />
              )}
            </i>
            <span className="siderail__label">
              {item.chapter} · {item.label}
            </span>
            <span className="siderail__count" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          </a>
        ))}
      </nav>

      <div className="archive-console__sound">
        <SoundToggle />
      </div>
    </aside>
  );
}
