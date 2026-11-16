import { create } from 'zustand';
import type { ComponentType } from 'react';
import type { SlotDescriptor, OverrideDescriptor, NavTabDescriptor } from './types';

export interface ActiveSubPage {
  id: string;
  component: ComponentType<Record<string, unknown>>;
  params?: Record<string, unknown>;
}

export interface ActiveModal {
  id: string;
  component: ComponentType<Record<string, unknown>>;
  params?: Record<string, unknown>;
}

interface PluginUIState {
  slots: Record<string, SlotDescriptor[]>;
  overrides: Record<string, OverrideDescriptor>;
  registeredSubPages: Record<string, ComponentType<Record<string, unknown>>>;
  registeredModals: Record<string, ComponentType<Record<string, unknown>>>;

  subPageStack: ActiveSubPage[];
  activeSubPage: ActiveSubPage | null;
  activeModal: ActiveModal | null;

  enabledPlugins: Record<string, boolean>;

  navTabs: NavTabDescriptor[];

  registerSlot: (slot: SlotDescriptor) => void;
  unregisterSlotsByPlugin: (pluginId: string) => void;

  registerOverride: (override: OverrideDescriptor) => void;
  unregisterOverridesByPlugin: (pluginId: string) => void;

  registerNavTab: (tab: NavTabDescriptor) => void;
  unregisterNavTabsByPlugin: (pluginId: string) => void;

  registerSubPage: (id: string, comp: ComponentType<Record<string, unknown>>) => void;
  openSubPage: (id: string, params?: Record<string, unknown>) => void;
  closeSubPage: () => void;

  registerModal: (id: string, comp: ComponentType<Record<string, unknown>>) => void;
  openModal: (id: string, params?: Record<string, unknown>) => void;
  closeModal: () => void;

  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
}

export const usePluginUIStore = create<PluginUIState>((set, get) => ({
  slots: {},
  overrides: {},
  registeredSubPages: {},
  registeredModals: {},
  subPageStack: [],
  activeSubPage: null,
  activeModal: null,
  enabledPlugins: {},
  navTabs: [],

  registerSlot: (slot) => {
    set((state) => {
      const existing = state.slots[slot.slotName] || [];
      const filtered = existing.filter(
        (s) => !(s.pluginId === slot.pluginId && s.render === slot.render)
      );
      const updated = [...filtered, slot].sort((a, b) => b.order - a.order);
      return {
        slots: {
          ...state.slots,
          [slot.slotName]: updated,
        },
      };
    });
  },

  unregisterSlotsByPlugin: (pluginId) => {
    set((state) => {
      const nextSlots: Record<string, SlotDescriptor[]> = {};
      for (const [name, list] of Object.entries(state.slots)) {
        nextSlots[name] = list.filter((s) => s.pluginId !== pluginId);
      }
      return { slots: nextSlots };
    });
  },

  registerOverride: (override) => {
    set((state) => ({
      overrides: {
        ...state.overrides,
        [override.pointName]: override,
      },
    }));
  },

  unregisterOverridesByPlugin: (pluginId) => {
    set((state) => {
      const nextOverrides: Record<string, OverrideDescriptor> = {};
      for (const [point, desc] of Object.entries(state.overrides)) {
        if (desc.pluginId !== pluginId) {
          nextOverrides[point] = desc;
        }
      }
      return { overrides: nextOverrides };
    });
  },

  registerNavTab: (tab) => {
    set((state) => {
      const existing = state.navTabs.filter((t) => t.id !== tab.id);
      const updated = [...existing, tab].sort(
        (a, b) => (a.order ?? 50) - (b.order ?? 50)
      );
      return { navTabs: updated };
    });
  },

  unregisterNavTabsByPlugin: (pluginId) => {
    set((state) => ({
      navTabs: state.navTabs.filter((t) => t.pluginId !== pluginId),
    }));
  },

  registerSubPage: (id, comp) => {
    set((state) => ({
      registeredSubPages: {
        ...state.registeredSubPages,
        [id]: comp,
      },
    }));
  },

  openSubPage: (id, params) => {
    const comp = get().registeredSubPages[id];
    if (comp) {
      const newPage: ActiveSubPage = { id, component: comp, params };
      set((state) => ({
        subPageStack: [...state.subPageStack, newPage],
        activeSubPage: newPage,
      }));
    }
  },

  closeSubPage: () => {
    set((state) => {
      const nextStack = state.subPageStack.slice(0, -1);
      const nextActive = nextStack.length > 0 ? nextStack[nextStack.length - 1] : null;
      return {
        subPageStack: nextStack,
        activeSubPage: nextActive,
      };
    });
  },

  registerModal: (id, comp) => {
    set((state) => ({
      registeredModals: {
        ...state.registeredModals,
        [id]: comp,
      },
    }));
  },

  openModal: (id, params) => {
    const comp = get().registeredModals[id];
    if (comp) {
      set({ activeModal: { id, component: comp, params } });
    }
  },

  closeModal: () => {
    set({ activeModal: null });
  },

  setPluginEnabled: (pluginId, enabled) => {
    set((state) => ({
      enabledPlugins: {
        ...state.enabledPlugins,
        [pluginId]: enabled,
      },
    }));
  },
}));
