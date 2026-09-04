import { forwardRef, type HTMLAttributes } from 'react';

/* ============================================================================
   MOTION / TEXT REVEAL — overflow-hidden mask text reveal.
   
   When hovering over a link or interactive container:
   The primary text slides up and disappears out of the overflow mask, while a
   duplicate string slides up from the bottom to replace it seamlessly.

   Accessibility:
   The primary line carries the readable text; the duplicate is aria-hidden.
   Collapses cleanly under prefers-reduced-motion.
   ========================================================================== */

export interface TextRevealProps extends HTMLAttributes<HTMLSpanElement> {
  text: string;
  className?: string;
  primaryClassName?: string;
  duplicateClassName?: string;
}

export const TextReveal = forwardRef<HTMLSpanElement, TextRevealProps>(
  function TextReveal(
    { text, className = '', primaryClassName = '', duplicateClassName = '', ...rest },
    ref,
  ) {
    return (
      <span ref={ref} className={`text-reveal ${className}`} {...rest}>
        <span className="text-reveal__sr">{text}</span>
        <span className="text-reveal__mask" aria-hidden="true">
          <span className={`text-reveal__line text-reveal__line--primary ${primaryClassName}`}>
            {text}
          </span>
          <span className={`text-reveal__line text-reveal__line--duplicate ${duplicateClassName}`}>
            {text}
          </span>
        </span>
      </span>
    );
  },
);
