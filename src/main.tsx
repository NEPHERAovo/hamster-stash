import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-700.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './index.css';
import './core/plugin/setup';
import App from './App.tsx';
import { RootErrorBoundary } from './components/ui/RootErrorBoundary';
import { usePwaStore, type BeforeInstallPromptEvent } from './stores/usePwaStore';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setInstallPrompt(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    usePwaStore.getState().markInstalled();
  });

  if (window.matchMedia) {
    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    standaloneMq.addEventListener?.('change', (e) => {
      if (e.matches) {
        usePwaStore.getState().markInstalled();
      }
    });
  }

  if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
    (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
      .getInstalledRelatedApps()
      .then((apps) => {
        if (apps && apps.length > 0) {
          usePwaStore.getState().markInstalled();
        }
      })
      .catch(() => void 0);
  }
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
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
