/// <reference types="vite/client" />

/* Allow CSS custom properties (design tokens like --c, --a1, --rr) in style
   objects across the app without per-object casts.
   Importing 'react' first makes this a module AUGMENTATION (merge), not a
   replacement of the React types. */
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
