import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    CloseWatcher?: new (options?: { signal?: AbortSignal }) => CloseWatcherInstance;
  }
}

interface CloseWatcherInstance extends EventTarget {
  requestClose(): void;
  close(): void;
  destroy(): void;
  oncancel: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
}

export interface UseCloseWatcherOptions {
  isOpen: boolean;
  onClose: () => void;
  disabled?: boolean;
}

interface FallbackEntry {
  id: number;
  onClose: () => void;
}

const HISTORY_STATE_KEY = '__hsOverlayId';
let nextEntryId = 1;
const fallbackStack: FallbackEntry[] = [];
let listenersAttached = false;

const getCurrentHistoryOverlayId = (): number | undefined => {
  const state = window.history.state as Record<string, unknown> | null;
  const val = state?.[HISTORY_STATE_KEY];
  return typeof val === 'number' ? val : undefined;
};

const handleFallbackPopState = () => {
  const top = fallbackStack[fallbackStack.length - 1];
  if (!top) return;
  if (getCurrentHistoryOverlayId() === top.id) return;
  fallbackStack.pop();
  detachFallbackListenersIfEmpty();
  top.onClose();
};

const handleFallbackKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  const top = fallbackStack[fallbackStack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.onClose();
};

const attachFallbackListeners = () => {
  if (listenersAttached) return;
  window.addEventListener('popstate', handleFallbackPopState);
  window.addEventListener('keydown', handleFallbackKeyDown);
  listenersAttached = true;
};

const detachFallbackListenersIfEmpty = () => {
  if (!listenersAttached || fallbackStack.length > 0) return;
  window.removeEventListener('popstate', handleFallbackPopState);
  window.removeEventListener('keydown', handleFallbackKeyDown);
  listenersAttached = false;
};

const registerFallbackOverlay = (onClose: () => void): (() => void) => {
  const id = nextEntryId++;
  const entry: FallbackEntry = { id, onClose };
  fallbackStack.push(entry);
  attachFallbackListeners();

  try {
    const baseState =
      window.history.state && typeof window.history.state === 'object'
        ? (window.history.state as Record<string, unknown>)
        : {};
    window.history.pushState({ ...baseState, [HISTORY_STATE_KEY]: id }, '');
  } catch {
    void 0;
  }

  return () => {
    const idx = fallbackStack.indexOf(entry);
    if (idx === -1) return;
    fallbackStack.splice(idx, 1);
    detachFallbackListenersIfEmpty();

    if (getCurrentHistoryOverlayId() === id) {
      try {
        window.history.back();
      } catch {
        void 0;
      }
    }
  };
};

const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

const registerEscapeOnlyFallback = (onClose: () => void): (() => void) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
};

export function useCloseWatcher({
  isOpen,
  onClose,
  disabled = false,
}: UseCloseWatcherOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || disabled || typeof window === 'undefined') return;

    if ('CloseWatcher' in window && window.CloseWatcher) {
      const watcher = new window.CloseWatcher();

      watcher.onclose = () => {
        onCloseRef.current();
      };

      return () => {
        watcher.destroy();
      };
    }

    if (isIosDevice()) {
      return registerEscapeOnlyFallback(() => onCloseRef.current());
    }

    return registerFallbackOverlay(() => onCloseRef.current());
  }, [isOpen, disabled]);
}

export default useCloseWatcher;
