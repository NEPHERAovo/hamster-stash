import { create } from 'zustand';
import { checkIsStandalone } from '../utils/browser';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaState {
  needRefresh: boolean;
  dismissed: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isInstalled: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  updateHandler: ((reloadPage?: boolean) => Promise<void>) | null;
  registration: ServiceWorkerRegistration | null;
  bindServiceWorker: (
    updateHandler: (reloadPage?: boolean) => Promise<void>,
    registration?: ServiceWorkerRegistration
  ) => void;
  setRegistration: (registration: ServiceWorkerRegistration) => void;
  markNeedRefresh: () => void;
  dismissPrompt: () => void;
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<'update_available' | 'up_to_date' | 'unsupported'>;
  setInstallPrompt: (event: BeforeInstallPromptEvent | null) => void;
  markInstalled: () => void;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>;
  checkIsInstalled: () => boolean;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  needRefresh: false,
  dismissed: false,
  isChecking: false,
  isUpdating: false,
  isInstalled: checkIsStandalone(),
  installPrompt: null,
  updateHandler: null,
  registration: null,

  bindServiceWorker: (updateHandler, registration) => {
    set({
      updateHandler,
      ...(registration ? { registration } : {}),
    });
  },

  setRegistration: (registration) => {
    set({ registration });
  },

  markNeedRefresh: () => {
    set({ needRefresh: true, dismissed: false });
  },

  dismissPrompt: () => {
    set({ dismissed: true });
  },

  applyUpdate: async () => {
    const { updateHandler, registration } = get();
    set({ isUpdating: true });

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    if (updateHandler) {
      try {
        await updateHandler(true);
      } catch {
        void 0;
      }
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 3000);
  },

  checkForUpdates: async () => {
    const { registration, needRefresh } = get();
    if (needRefresh) {
      set({ dismissed: false });
      return 'update_available';
    }
    if (!registration) {
      return 'unsupported';
    }

    set({ isChecking: true });
    try {
      await registration.update();
      if (registration.installing) {
        await new Promise<void>((resolve) => {
          const worker = registration.installing;
          if (!worker) {
            resolve();
            return;
          }
          const onStateChange = () => {
            if (
              worker.state === 'installed' ||
              worker.state === 'activated' ||
              worker.state === 'redundant'
            ) {
              worker.removeEventListener('statechange', onStateChange);
              resolve();
            }
          };
          worker.addEventListener('statechange', onStateChange);
          window.setTimeout(resolve, 3000);
        });
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }

      if (get().needRefresh || registration.waiting || registration.installing) {
        set({ needRefresh: true, dismissed: false });
        return 'update_available';
      }
      return 'up_to_date';
    } catch {
      return 'up_to_date';
    } finally {
      set({ isChecking: false });
    }
  },

  setInstallPrompt: (event) => {
    set({ installPrompt: event });
  },

  markInstalled: () => {
    set({ isInstalled: true, installPrompt: null });
  },

  promptInstall: async () => {
    const { installPrompt } = get();
    if (!installPrompt) return 'unsupported';
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      set({ installPrompt: null });
      if (choice.outcome === 'accepted') {
        set({ isInstalled: true });
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      set({ installPrompt: null });
      return 'unsupported';
    }
  },

  checkIsInstalled: () => {
    const installed = checkIsStandalone();
    set({ isInstalled: installed });
    return installed;
  },
}));
