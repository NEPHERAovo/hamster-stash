import type { BasePlugin, LazyPluginDefinition } from './types';
import { LazyPluginWrapper } from './LazyPluginWrapper';
import { PluginRegistry } from './PluginRegistry';
import type { DataAdapter } from '../../types/adapter';
import { IndexedDBAdapter } from '../adapters/IndexedDBAdapter';

export class PluginManager {
  private registry: PluginRegistry;
  private initialized = false;

  constructor(adapter?: DataAdapter) {
    const actAdapter = adapter || new IndexedDBAdapter();
    this.registry = new PluginRegistry(actAdapter);
  }

  getRegistry(): PluginRegistry {
    return this.registry;
  }

  registerPlugin(plugin: BasePlugin): void {
    this.registry.register(plugin);
  }

  registerLazyPlugin(def: LazyPluginDefinition): void {
    const wrapper = new LazyPluginWrapper(def.manifest, def.load);
    this.registry.register(wrapper);
  }

  getPlugins(): BasePlugin[] {
    return this.registry.getPlugins();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const adapter = this.registry.getAdapter();
    if (adapter && typeof adapter.initialize === 'function') {
      try {
        await adapter.initialize();
      } catch (err) {
        console.error('Failed to initialize adapter in PluginManager:', err);
      }
    }

    const storage = this.registry.getStorageManager();
    const plugins = this.registry.getPlugins();

    for (const plugin of plugins) {
      const id = plugin.manifest.id;
      const settings = storage.createSettingsAccessor(id);
      const enabled = await settings.get<boolean>('enabled', plugin.manifest.defaultEnabled);
      if (enabled) {
        try {
          await this.registry.activate(id);
        } catch (err) {
          console.error(`Failed to activate plugin "${id}":`, err);
        }
      }
    }
  }

  async enablePlugin(id: string): Promise<void> {
    const plugin = this.registry.getPlugin(id);
    if (!plugin) return;

    await this.registry.activate(id);
    const storage = this.registry.getStorageManager();
    const settings = storage.createSettingsAccessor(id);
    await settings.set('enabled', true);
  }

  async disablePlugin(id: string): Promise<void> {
    await this.registry.deactivate(id);
    const storage = this.registry.getStorageManager();
    const settings = storage.createSettingsAccessor(id);
    await settings.set('enabled', false);
  }

  isPluginEnabled(id: string): boolean {
    return this.registry.isActivated(id);
  }

  async runMiddleware<P = unknown, R = unknown>(
    hookName: string,
    payload: P,
    finalHandler: (payload: P) => Promise<R>
  ): Promise<R> {
    return this.registry.getPipeline().run<P, R>(hookName, payload, finalHandler);
  }
}

export const pluginManager = new PluginManager();
