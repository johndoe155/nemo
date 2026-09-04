/* CardImage — responsive art with a true blur-up (mirrors the Hub's pattern).
   · <picture> serves AVIF renditions (540/840/full) when supported, with the
     source JPEG as the fallback; `sizes` lets the browser pick by slot width.
   · While the bitmap streams, the inline 24px WebP LQIP paints as the img
     background so the fade-in lands on an image, never a void. Fixed aspect
     boxes in the card keep zero layout shift.
   · The load fade is DOM-mutated (no per-card React state → no re-render). */

import { ART_LQIP, ART_SRCSET } from '../lib/art-variants';

export default function CardImage({
  src,
  alt,
  sizes,
  eager = false,
  fetchpriority,
  className,
  onLoaded,
}: {
  src: string;
  alt: string;
  sizes: string;
  eager?: boolean;
  fetchpriority?: 'high' | 'auto' | 'low';
  className?: string;
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
          e.currentTarget.style.opacity = '1';
          onLoaded?.(e.currentTarget);
        }}
        style={{
          ...(lqip
            ? {
                backgroundImage: `url("${lqip}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
          opacity: 0,
          transition: 'opacity 0.7s ease',
        }}
      />
    </picture>
  );
}
