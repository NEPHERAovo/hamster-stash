import { pluginManager } from './PluginManager';

export function setupBuiltinPlugins(): void {
  pluginManager.registerLazyPlugin({
    manifest: {
      id: 'owned-items',
      name: '物品与订阅',
      version: '1.0.0',
      description: '记录实体物品与数字订阅服务，计算日均使用成本。',
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
