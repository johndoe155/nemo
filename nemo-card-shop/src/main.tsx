import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CardShop from './CardShop';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root mount node');

createRoot(rootEl).render(
  <StrictMode>
    <CardShop />
  </StrictMode>,
);
