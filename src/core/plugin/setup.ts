import { pluginManager } from './PluginManager';

export function setupBuiltinPlugins(): void {
  pluginManager.registerLazyPlugin({
    manifest: {
      id: 'owned-items',
      name: '持有物品',
      version: '1.0.0',
      description: '追踪大件与数码物品生命周期、购入沉淀、配件维护与日均持有成本。',
      icon: 'package',
      defaultEnabled: false,
    },
    load: async () => {
      const { OwnedItemsPlugin } = await import('../../plugins/owned-items');
      return new OwnedItemsPlugin();
    },
  });
}

setupBuiltinPlugins();
