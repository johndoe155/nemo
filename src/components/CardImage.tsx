/* ============================================================================
   CardImage — responsive art with a true blur-up.

   · <picture> serves AVIF renditions (540/840/full width) when the browser
     supports them, falling back to the original JPEG — the browser negotiates
     the <source> type natively, and the rendition is chosen by slot width via
     `sizes` instead of shipping 1086px to a 280px slot.
   · While the bitmap streams, a 24px-wide inline WebP LQIP paints as the
     img background — scaled to the box it reads as a soft blur, so the
     load fade lands on an already-present image instead of a void.
   · The load fade is DOM-mutated in onLoad (no per-card React state → no
     re-render of the parent grid on every decode).
============================================================================ */

import { ART_LQIP, ART_SRCSET } from '../lib/art-variants';

export default function CardImage({
  src,
  alt,
  sizes,
  eager = false,
  fade = true,
  className,
  fetchpriority,
  onLoaded,
}: {
  /** Original JPEG URL as produced by `art()` in lib/data.ts. */
  src: string;
  alt: string;
  sizes: string;
  eager?: boolean;
  /** LQIP → bitmap opacity fade. Pass false when the surface already owns
   * its own opacity treatment (e.g. the hero's 0.55 key art). */
  fade?: boolean;
  className?: string;
  fetchpriority?: 'high' | 'auto' | 'low';
  /** Called with the img element once decoded — lets card shells retire
   * their skeleton layers without per-card React state. */
  onLoaded?: (img: HTMLImageElement) => void;
}) {
  const name = src.split('/').pop() ?? '';
  const srcset = ART_SRCSET[name];
  const lqip = ART_LQIP[name];

  return (
    <picture>
      {srcset && <source type="image/avif" srcSet={srcset} sizes={sizes} />}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={fetchpriority ?? (eager ? 'high' : 'auto')}
        onLoad={(e) => {
          if (fade) e.currentTarget.style.opacity = '1';
          onLoaded?.(e.currentTarget);
        }}
        style={fade ? {
          ...(lqip
            ? { backgroundImage: `url("${lqip}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}),
          opacity: 0,
          transition: 'opacity 0.8s ease',
        } : undefined}
      />
    </picture>
  );
}
