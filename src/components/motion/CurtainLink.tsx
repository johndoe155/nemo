import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * A deliberately small two-line text mask for footer navigation.
 *
 * The visible copy is duplicated so the hover state can replace the current
 * line in place. The screen-reader copy stays as one plain string; this keeps
 * the visual treatment decorative rather than making assistive technology
 * read the label twice.
 */
export interface CurtainLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'aria-label'> {
  label: string;
  meta?: ReactNode;
  screenReaderLabel?: string;
}

export function CurtainLink({
  label,
  meta,
  screenReaderLabel,
  className = '',
  ...props
}: CurtainLinkProps) {
  return (
    <a
      {...props}
      className={`curtain-link ${className}`.trim()}
      aria-label={screenReaderLabel ?? label}
    >
      <span className="curtain-link__mask" aria-hidden="true">
        <span className="curtain-link__text">{label}</span>
        <span className="curtain-link__text curtain-link__text--duplicate">{label}</span>
      </span>
      {meta && <span className="curtain-link__meta" aria-hidden="true">{meta}</span>}
      <span className="vh">{screenReaderLabel ?? label}</span>
    </a>
  );
}
