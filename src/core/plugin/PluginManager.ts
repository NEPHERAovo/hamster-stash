import type { BasePlugin, LazyPluginDefinition } from './types';
import { LazyPluginWrapper } from './LazyPluginWrapper';
import { PluginRegistry } from './PluginRegistry';
import type { AdapterResolver } from './PluginStorageManager';

export class PluginManager {
  private registry: PluginRegistry;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private ensureReady: (() => Promise<void>) | null = null;

  constructor(adapter?: AdapterResolver, ensureReady?: () => Promise<void>) {
    this.registry = new PluginRegistry(adapter);
    this.ensureReady = ensureReady ?? null;
  }

  bindAdapter(adapter: AdapterResolver, ensureReady?: () => Promise<void>): void {
    this.registry.setAdapter(adapter);
    this.ensureReady = ensureReady ?? null;
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
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          if (this.ensureReady) {
            await this.ensureReady();
          } else {
            const adapter = this.registry.getAdapter();
            if (adapter && typeof adapter.initialize === 'function') {
              await adapter.initialize();
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
          this.initialized = true;
        } catch (err) {
          console.error('Failed to initialize plugins in PluginManager:', err);
        } finally {
          this.initPromise = null;
        }
      })();
    }
    await this.initPromise;
  }

  async enablePlugin(id: string): Promise<void> {
    const plugin = this.registry.getPlugin(id);
    if (!plugin) return;

    if (this.ensureReady) {
      await this.ensureReady();
    }

    await this.registry.activate(id);
    const storage = this.registry.getStorageManager();
    const settings = storage.createSettingsAccessor(id);
    await settings.set('enabled', true);
  }

  async disablePlugin(id: string): Promise<void> {
    if (this.ensureReady) {
      await this.ensureReady();
    }

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

  emitHostEvent(event: string, ...args: unknown[]): void {
    this.registry.emitEvent(event, ...args);
  }
}

export const pluginManager = new PluginManager();
