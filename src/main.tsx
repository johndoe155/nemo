import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/space-grotesk';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './styles/global.css';
import './styles/components.css';
import './styles/overhaul.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
