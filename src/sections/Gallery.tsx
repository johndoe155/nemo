import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useScroll } from 'framer-motion';
import SphereImageGrid, { type ImageData } from '@/components/ui/img-sphere';
import { ARTISTS, GALLERY_PLATES, UNIVERSES } from '../lib/data';

/* ---------------------------------------------------------------------------
   02 · THE ROTUNDA
   The rotunda sits directly after the Nemoverse roster: the roster is the
   sortable registry (specs, supply, price), this is the same canon hung as a
   sphere you can spin. Rebuilt from the CircularGallery ring onto the
   SphereImageGrid (src/components/ui/img-sphere.tsx) — the section shell,
   anchor (#rotunda — it is a nav target) and stage footprint are unchanged;
   only the 3D stage itself was replaced. All copy is passed in as props or
   defined here — the component owns no strings — and the badge counts are
   derived from the data layer so they can never drift from the registry.
--------------------------------------------------------------------------- */

/* ------------------------------- Badges ---------------------------------- */

interface GalleryBadge {
  /** Label rendered after the count, e.g. 'REGISTERED UNIVERSES'. */
  label: string;
  /** Numeric (or pre-formatted) value for the badge. */
  count: number | string;
  /** Optional accent — defaults to the Nemoverse gold. */
  accent?: string;
}

const ROTUNDA_BADGES: GalleryBadge[] = [
  { label: 'PLATES IN ROTATION', count: GALLERY_PLATES.length, accent: 'var(--cyan)' },
  { label: 'REGISTERED UNIVERSES', count: UNIVERSES.length, accent: 'var(--iris)' },
  { label: 'CANON ARTISTS', count: ARTISTS.length, accent: 'var(--gold)' },
];

/* ------------------------------ Sphere data ------------------------------- */

/** The canon plates (key art + one per universe + variants), mapped into the
    sphere component's image shape. Registry code rides in the title, the
    style line and artist credit ride in the description. */
const BASE_IMAGES: Omit<ImageData, 'id'>[] = GALLERY_PLATES.map((plate) => ({
  src: plate.image,
  alt: plate.alt,
  title: `${plate.code} — ${plate.title}`,
  description: `${plate.subtitle} · Art by ${plate.credit}`,
}));

/**
 * The sphere reads best densely populated — the reference demo repeats its 12
 * base images across 60 nodes, so the 12 canon plates are cycled the same
 * way. Each repetition gets a numbered alt so screen readers can tell the
 * nodes apart.
 */
const SPHERE_IMAGE_COUNT = 60;
const SPHERE_IMAGES: ImageData[] = [];
for (let i = 0; i < SPHERE_IMAGE_COUNT; i++) {
  const base = BASE_IMAGES[i % BASE_IMAGES.length];
  SPHERE_IMAGES.push({
    id: `plate-${i + 1}`,
    ...base,
    alt: `${base.alt} (${Math.floor(i / BASE_IMAGES.length) + 1})`,
  });
}

/**
 * Sphere behaviour — the reference demo's configuration. containerSize and
 * sphereRadius are omitted: they are measured from the stage below so the
 * sphere fills the same box the ring did, keeping the demo's 600:200 ratio.
 */
const SPHERE_CONFIG = {
  dragSensitivity: 0.8, // Mouse drag sensitivity (0.1 - 2.0)
  momentumDecay: 0.96, // How fast momentum fades (0.8 - 0.99)
  maxRotationSpeed: 6, // Maximum rotation speed (1 - 10)
  baseImageScale: 0.15, // Base image size as a fraction of the container
  hoverScale: 1.3, // Hover scale multiplier (1.0 - 2.0)
  perspective: 1000, // CSS perspective value (500 - 2000)
  autoRotate: true, // Ambient spin when idle
  autoRotateSpeed: 0.2, // Auto rotation speed (0.1 - 2.0)
};

/** Reference sphere proportions from the demo (600px container / 200 radius). */
const SPHERE_RADIUS_RATIO = 3;

/* -------------------------------- Section -------------------------------- */

/* Reduced motion is read once at module level: the sphere's ambient spin,
   the scroll-gust and the step easing all collapse to instant/static states
   (the component owns the behavior; the section owns the props). */
const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Gallery() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [inView, setInView] = useState(false);
  /* The page-scroll position feeds the sphere's gust channel — being
     scrolled past nudges its spin (DESIGN_AUDIT P3.2b). */
  const { scrollY: pageScroll } = useScroll();

  /* Measure the stage so the fixed-size sphere can be sized to it. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => setStageBox({ w: stage.clientWidth, h: stage.clientHeight });
    measure();

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /* Mount the sphere only while the rotunda is near the viewport. The
     component animates via requestAnimationFrame + state every frame, so
     parking it off-screen keeps the rest of the page at full budget — the
     same discipline the ring-based rotunda had. Generous margins mean it
     is mounted well before it scrolls into view. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { rootMargin: '35% 0px' },
    );
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  /* Fit the sphere to the stage: the same 600:200 container/radius ratio as
     the reference demo, clamped to the stage box (with breathing room) so it
     never overflows the section on small screens. */
  const containerSize = Math.round(
    Math.max(
      280,
      Math.min(
        stageBox.w > 0 ? stageBox.w - 48 : 600,
        stageBox.h > 0 ? stageBox.h - 48 : 600,
        600,
      ),
    ),
  );
  const sphereRadius = Math.round(containerSize / SPHERE_RADIUS_RATIO);

  return (
    <section className="section cg" id="rotunda">
      <div className="shell">
        <header className="cg__head">
          <div className="cg__headtext">
            <span className="kicker">II · THE PHYSICAL ARCHIVE</span>
            <h2 className="display cg__title">
              A room<br />without walls.
            </h2>
          </div>
          <div className="cg__aside">
            <p className="cg__sub">
              The registry becomes a suspended museum. Sixty plates orbit one quiet center;
              touch one and the room lowers its voice.
            </p>
            <span>DRAG TO ALTER GRAVITY</span>
          </div>
          <ul className="cg__badges" aria-label="Rotunda catalog data">
            {ROTUNDA_BADGES.map((b) => (
              <li className="cg__badge" key={b.label} style={{ '--c': b.accent ?? 'var(--gold)' } as CSSProperties}>
                <b>{b.count}</b><span>{b.label}</span>
              </li>
            ))}
          </ul>
        </header>
      </div>

      <div ref={stageRef} className="cg-stage cg-stage--sphere">
        <div className="cg-stage__architecture" aria-hidden="true">
          <span className="cg-stage__ceiling" />
          <span className="cg-stage__beam" />
          <span className="cg-stage__floor" />
          <span className="cg-stage__axis">N / 00°</span>
          <span className="cg-stage__room">ROTUNDA 02</span>
        </div>
        {REDUCE && (
          <figure className="cg-stage__still">
            <img src={GALLERY_PLATES[0].image} alt={GALLERY_PLATES[0].alt} />
            <figcaption><b>{GALLERY_PLATES[0].code}</b><span>{GALLERY_PLATES[0].title}</span></figcaption>
          </figure>
        )}
        {!REDUCE && inView && stageBox.w > 0 && (
          <SphereImageGrid
            images={SPHERE_IMAGES}
            containerSize={containerSize}
            sphereRadius={sphereRadius}
            {...SPHERE_CONFIG}
            autoRotate={!REDUCE && SPHERE_CONFIG.autoRotate}
            gust={pageScroll}
            ariaLabel={`Rotunda — ${SPHERE_IMAGES.length} plates on a drifting sphere. Left and right arrow keys bring the next plate to the front, Enter inspects it.`}
          />
        )}
      </div>

      <div className="shell">
      {REDUCE && (
        /* P2.1 — reduced motion: the audit's verdict is literal. The 3D
           sphere does not mount at all; the plates become a plain list of
           real figures, in registry order, fully readable and focusable
           without any motion or gesture. */
        <ul className="cg__flat">
          {GALLERY_PLATES.map((plate) => (
            <li key={plate.code}>
              <figure>
                <img src={plate.image} alt={plate.alt} loading="lazy" style={{ objectPosition: plate.focus }} />
                <figcaption>
                  <b>{plate.code} — {plate.title}</b>
                  <span>{plate.subtitle} · Art by {plate.credit}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      {/* P2.1 — the sphere is drag/keyboard furniture; the CANON ITSELF is
         mirrored here as plain list content, so assistive tech and search
         crawpers traverse all twelve plates as text, not as sixty nodes of
         aria-hidden chrome. One entry per unique plate (the sphere repeats
         the set to populate the globe). Skipped under REDUCE, where the
         visible flat list IS the content. */}
      {!REDUCE && (
      <ul className="vh">
        {GALLERY_PLATES.map((plate) => (
          <li key={plate.code}>
            {plate.code} — {plate.title}. {plate.subtitle}. Art by {plate.credit}.
          </li>
        ))}
      </ul>
      )}
      </div>

      <div className="shell">
        <p className="cg__hint" {...(REDUCE ? { style: { display: 'none' } } : {})}>
          <span className="cg__hint-keys" aria-hidden="true" />
          Drag · flick · tap a plate to open — or focus the sphere and use arrows + Enter
        </p>
      </div>
    </section>
  );
}
