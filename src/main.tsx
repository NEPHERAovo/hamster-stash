import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/geist-sans';
import '@fontsource/geist-mono';
import '@fontsource/instrument-serif';
import './index.css';
import './core/plugin/setup';
import App from './App.tsx';
import { usePwaStore, type BeforeInstallPromptEvent } from './stores/usePwaStore';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setInstallPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    usePwaStore.getState().markInstalled();
  });
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let lastCheckAt = 0;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePwaStore.getState().markNeedRefresh();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      usePwaStore.getState().setRegistration(registration);
      const checkIfDue = () => {
        const now = Date.now();
        if (now - lastCheckAt < 10 * 60 * 1000) return;
        lastCheckAt = now;
        void registration.update().catch(() => void 0);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkIfDue();
        }
      });
    },
  });
  usePwaStore.getState().bindServiceWorker(updateSW);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
