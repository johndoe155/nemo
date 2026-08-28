import React from 'react';
import ReactDOM from 'react-dom/client';
// TYPE STACK — Awwwards-grade typographic system.
//   PP Neue Machina  (Inktrap + Plain)   — self-hosted Pangram Pangram display faces
//   PP Neue Montreal (+ Text)            — self-hosted body/reading faces
//   Space Grotesk                         — retained tech-forward accent face
// Unbounded / Inter / Space Mono have been PURGED from the bundle.
// The PP families are registered as @font-face rules and exposed as
// --font-pp-* raw family tokens on :root; the canonical semantic tokens
// (--font-display/heading/body/body-text/accent) are mapped in global.css.
import '@fontsource-variable/space-grotesk';
import '@fontsource/michroma';
import './assets/fonts/pp-fonts.css';
import './styles/global.css';
import './styles/components.css';
import './styles/overhaul.css';
import './styles/audit-gaps.css';
import './styles/portal.css';
import './styles/nemo-chat.css';
// Art-directed typographic application layer — loaded LAST so the role
// assignments (Plain sub-headings/nav, Montreal Text dense reading, active
// pills, tabular counters) take precedence over the base component rules.
import './styles/typography.css';
// 04 · PILLAR 3 — cyber-luxury split-canvas rebuild (loads after typography
// so its scoped art direction wins where tokens overlap).
import './styles/pulls.css';
// 3D rotunda (CircularGallery) — scoped .cg-* layer, last so its plate
// typography wins where tokens overlap.
import './styles/circular-gallery.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

