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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disabled]);
}

export default useCloseWatcher;
