/* ============================================================================
   MOTION / ROLL TEXT — the pure single-layer character roll for navigation,
   links and utility buttons (no swap copy — the same label rolls through).

   Each character carries a duplicate parked 100% below its mask; when an
   interactive ancestor (:is(a, button, [role=button])) is hovered/focused,
   every char slides up one slot with a 22ms/char cascade. Transitions run on
   `transform` only, so this costs zero layout and no JS per frame.

   AT contract: a visually-hidden plain-text copy carries the accessible
   name; the split characters are aria-hidden.
============================================================================ */

export function RollText({ text, className = '' }: { text: string; className?: string }) {
  const chars = Array.from(text);
  return (
    <span className={`rt ${className}`}>
      <span className="rt__sr">{text}</span>
      <span className="rt__chars" aria-hidden="true">
        {chars.map((c, i) => (
          <span className="rt__ch" key={i} style={{ ['--i' as string]: i }}>
            <span className="rt__ch-in">{c === ' ' ? '\u00A0' : c}</span>
            <span className="rt__ch-in rt__ch-in--dup">{c === ' ' ? '\u00A0' : c}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
