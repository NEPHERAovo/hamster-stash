import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'error' | 'warning';
}

interface ToastState {
  currentToast: ToastMessage | null;
  showToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
  hideToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  currentToast: null,
  showToast: (text, type = 'success') => {
    if (toastTimer) clearTimeout(toastTimer);
    const id = Date.now().toString();
    set({ currentToast: { id, text, type } });
    toastTimer = setTimeout(() => {
      set({ currentToast: null });
    }, 2000);
  },
  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ currentToast: null });
  },
}));

/**
 * 全局轻提示方法 (替代原生 alert)
 */
export const toast = (text: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
  useToastStore.getState().showToast(text, type);
};

toast.success = (text: string) => toast(text, 'success');
toast.error = (text: string) => toast(text, 'error');
toast.info = (text: string) => toast(text, 'info');
toast.warning = (text: string) => toast(text, 'warning');
