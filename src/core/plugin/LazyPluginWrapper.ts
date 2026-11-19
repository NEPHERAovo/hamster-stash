import type { ReactNode } from 'react';
import { BasePlugin, type PluginManifest, type PluginContext } from './types';

export class LazyPluginWrapper extends BasePlugin {
  readonly manifest: PluginManifest;
  private readonly loader: () => Promise<BasePlugin>;
  private instance?: BasePlugin;

  constructor(
    manifest: PluginManifest,
    loader: () => Promise<BasePlugin>
  ) {
    super();
    this.manifest = manifest;
    this.loader = loader;
  }

  async getInstance(): Promise<BasePlugin> {
    if (!this.instance) {
      this.instance = await this.loader();
    }
    return this.instance;
  }

  isLoaded(): boolean {
    return Boolean(this.instance);
  }

  async onActivate(ctx: PluginContext): Promise<void> {
    const plugin = await this.getInstance();
    await plugin.onActivate(ctx);
  }

  async onDeactivate(ctx: PluginContext): Promise<void> {
    if (this.instance?.onDeactivate) {
      await this.instance.onDeactivate(ctx);
    }
  }

  renderSettings(ctx: PluginContext): ReactNode {
    return this.instance?.renderSettings?.(ctx);
  }
}
