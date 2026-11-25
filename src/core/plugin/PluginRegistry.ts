import type { ComponentType, ReactNode } from 'react';
import type { BasePlugin, PluginContext, MiddlewareHandler } from './types';
import { usePluginUIStore } from './SlotStore';
import { MiddlewarePipeline } from './MiddlewarePipeline';
import { PluginStorageManager } from './PluginStorageManager';
import type { DataAdapter } from '../../types/adapter';

export class PluginRegistry {
  private plugins = new Map<string, BasePlugin>();
  private activeContexts = new Map<string, PluginContext>();
  private pipeline = new MiddlewarePipeline();
  private storageManager: PluginStorageManager;
  private adapter: DataAdapter;
  private eventListeners = new Map<string, Map<string, Set<(...args: unknown[]) => void>>>();

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
    this.storageManager = new PluginStorageManager(adapter);
  }

  getAdapter(): DataAdapter {
    return this.adapter;
  }

  getPipeline(): MiddlewarePipeline {
    return this.pipeline;
  }

  getStorageManager(): PluginStorageManager {
    return this.storageManager;
  }

  register(plugin: BasePlugin): void {
    const id = plugin.manifest.id;
    if (this.plugins.has(id)) {
      console.warn(`Plugin "${id}" is already registered.`);
      return;
    }
    this.plugins.set(id, plugin);
  }

  getPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(id: string): BasePlugin | undefined {
    return this.plugins.get(id);
  }

  createContext(pluginId: string): PluginContext {
    const storageManager = this.storageManager;
    const pipeline = this.pipeline;
    const eventListeners = this.eventListeners;

    return {
      pluginId,

      ui: {
        registerSlot: (slotName, render, order = 0) => {
          usePluginUIStore.getState().registerSlot({
            pluginId,
            slotName,
            render,
            order,
          });
        },

        registerOverride: (pointName, overrideRender) => {
          usePluginUIStore.getState().registerOverride({
            pluginId,
            pointName,
            overrideRender: overrideRender as unknown as (props: Record<string, unknown>, OriginalComponent: ComponentType<Record<string, unknown>>) => ReactNode,
          });
        },

        registerSubPage: (subPageId, component) => {
          usePluginUIStore.getState().registerSubPage(subPageId, component);
        },

        openSubPage: (subPageId, params) => {
          usePluginUIStore.getState().openSubPage(subPageId, params);
        },

        closeSubPage: () => {
          usePluginUIStore.getState().closeSubPage();
        },

        registerModal: (modalId, component) => {
          usePluginUIStore.getState().registerModal(modalId, component);
        },

        openModal: (modalId, params) => {
          usePluginUIStore.getState().openModal(modalId, params);
        },

        closeModal: () => {
          usePluginUIStore.getState().closeModal();
        },

        registerNavTab: (tab) => {
          usePluginUIStore.getState().registerNavTab({
            ...tab,
            pluginId,
          });
        },
      },

      storage: {
        collection: <T extends { id: string }>(name: string) => {
          return storageManager.createCollection<T>(pluginId, name);
        },
      },

      settings: storageManager.createSettingsAccessor(pluginId),

      middleware: {
        use: <P = unknown, R = unknown>(hookName: string, handler: MiddlewareHandler<P, R>) => {
          pipeline.use(pluginId, hookName, handler);
        },
        register: <P = unknown, R = unknown>(hookName: string, handler: MiddlewareHandler<P, R>) => {
          pipeline.use(pluginId, hookName, handler);
        },
      },

      events: {
        on: (event, handler) => {
          let perEvent = eventListeners.get(event);
          if (!perEvent) {
            perEvent = new Map();
            eventListeners.set(event, perEvent);
          }
          let handlers = perEvent.get(pluginId);
          if (!handlers) {
            handlers = new Set();
            perEvent.set(pluginId, handlers);
          }
          handlers.add(handler);
          return () => {
            perEvent?.get(pluginId)?.delete(handler);
          };
        },
        emit: (event, ...args) => {
          this.emitEvent(event, ...args);
        },
      },
    };
  }

  emitEvent(event: string, ...args: unknown[]): void {
    const perEvent = this.eventListeners.get(event);
    if (!perEvent) return;
    perEvent.forEach((handlers) => {
      handlers.forEach((fn) => {
        try {
          fn(...args);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    });
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);

    if (this.activeContexts.has(pluginId)) {
      return; // 已经处于激活状态
    }

    const ctx = this.createContext(pluginId);
    this.activeContexts.set(pluginId, ctx);

    try {
      await plugin.onActivate(ctx);
      usePluginUIStore.getState().setPluginEnabled(pluginId, true);
    } catch (err) {
      this.activeContexts.delete(pluginId);
      throw err;
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    const ctx = this.activeContexts.get(pluginId);
    if (ctx && plugin.onDeactivate) {
      try {
        await plugin.onDeactivate(ctx);
      } catch (err) {
        console.error(`Error deactivating plugin "${pluginId}":`, err);
      }
    }

    usePluginUIStore.getState().unregisterSlotsByPlugin(pluginId);
    usePluginUIStore.getState().unregisterOverridesByPlugin(pluginId);
    usePluginUIStore.getState().unregisterNavTabsByPlugin(pluginId);
    this.pipeline.unregisterByPlugin(pluginId);
    this.eventListeners.forEach((perEvent) => {
      perEvent.delete(pluginId);
    });

    this.activeContexts.delete(pluginId);
    usePluginUIStore.getState().setPluginEnabled(pluginId, false);
  }

  isActivated(pluginId: string): boolean {
    return this.activeContexts.has(pluginId);
  }
}
