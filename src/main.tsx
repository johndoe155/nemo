import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
// Self-hosted Pangram Pangram families (PP Neue Machina Inktrap/Plain,
// PP Neue Montreal / Montreal Text). Registered as @font-face rules and
// exposed as --font-pp-* CSS custom properties on :root.
import './assets/fonts/pp-fonts.css';
import './styles/global.css';
import './styles/components.css';
import './styles/overhaul.css';
import './styles/audit-gaps.css';
import './styles/portal.css';
import './styles/hero-rings.css';
import './styles/nemo-chat.css';
import './styles/pp-fonts-demo.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
