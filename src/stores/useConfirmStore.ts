import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  handleResolve: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,
  confirm: (opts) => {
    const options: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      const prevResolver = get().resolver;
      if (prevResolver) prevResolver(false);

      set({
        isOpen: true,
        options,
        resolver: resolve,
      });
    });
  },
  handleResolve: (result: boolean) => {
    const resolver = get().resolver;
    if (resolver) resolver(result);
    set({
      isOpen: false,
      options: null,
      resolver: null,
    });
  },
}));

/**
 * 全局内部拟物确认弹窗 (替代原生 window.confirm)
 */
export const confirmAction = (options: ConfirmOptions | string): Promise<boolean> => {
  return useConfirmStore.getState().confirm(options);
};
