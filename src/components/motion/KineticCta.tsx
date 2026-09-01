/* ============================================================================
   MOTION / KINETIC CTA — the assembled tier-1/2 control: unified Magnetic
   physics + KineticLabel (or RollText for ghost/arrow variants) + optional
   GhostArrow, driven by one hover/focus state (pointer AND keyboard).

   compose rules (copy strategy approved in the audit):
     · primary / gold  → KineticLabel swap (label → swap)
     · ghost           → RollText label + morphing GhostArrow (no swap)
============================================================================ */

import { useState, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import { Magnetic, MagneticButton, type MagneticPreset } from './Magnetic';
import { KineticLabel } from './KineticLabel';
import { GhostArrow } from './GhostArrow';
import { RollText } from './RollText';

interface CtaShared {
  label: string;
  /** Swap copy shown on hover/focus. Omit for ghost/arrow variants. */
  swap?: string;
  className?: string;
  style?: CSSProperties;
  cursor?: string;
  preset?: MagneticPreset;
  /** Morphing chevron slot (ghost tier). */
  arrow?: boolean;
  /** Include the .btn-spark sheen span (default true on .btn variants). */
  spark?: boolean;
  block?: boolean;
  title?: string;
  ariaLabel?: string;
}

function useOpen() {
  const [open, setOpen] = useState(false);
  return {
    open,
    bind: {
      onPointerEnter: () => setOpen(true),
      onPointerLeave: () => setOpen(false),
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
    },
  };
}

function Label({ label, swap, open, arrow }: { label: string; swap?: string; open: boolean; arrow?: boolean }) {
  if (swap) return <KineticLabel label={label} swap={swap} open={open} />;
  if (arrow)
    return (
      <>
        <RollText text={label} />
        <GhostArrow open={open} />
      </>
    );
  return <RollText text={label} />;
}

export function KineticLink({
  label,
  swap,
  className = '',
  style,
  cursor,
  preset = 'pill',
  arrow = false,
  spark = true,
  block = false,
  title,
  ariaLabel,
  href,
  onClick,
}: CtaShared & { href: string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const { open, bind } = useOpen();
  return (
    <Magnetic preset={preset} className="kcta" block={block}>
      <a
        href={href}
        className={className}
        style={style}
        data-cursor={cursor}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        {...bind}
      >
        {spark && <span className="btn-spark" aria-hidden="true" />}
        <Label label={label} swap={swap} open={open} arrow={arrow} />
      </a>
    </Magnetic>
  );
}

export function KineticButton({
  label,
  swap,
  className = '',
  style,
  cursor,
  preset = 'pill',
  arrow = false,
  spark = true,
  title,
  ariaLabel,
  onClick,
  type = 'button',
  disabled,
  children,
}: CtaShared & {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Escape hatch: render custom children instead of the label pipeline. */
  children?: ReactNode;
}) {
  const { open, bind } = useOpen();
  return (
    <MagneticButton
      type={type}
      className={className}
      style={style}
      data-cursor={cursor}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      preset={preset}
      layers={spark ? <span className="btn-spark" aria-hidden="true" /> : undefined}
      {...bind}
    >
      {children ?? <Label label={label} swap={swap} open={open} arrow={arrow} />}
    </MagneticButton>
  );
}
