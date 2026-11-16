import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-sans';
import '@fontsource/geist-mono';
import '@fontsource/instrument-serif';
import './index.css';
import './core/plugin/setup';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
