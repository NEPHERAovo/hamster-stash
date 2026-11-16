import { pluginManager } from './PluginManager';
import { OwnedItemsPlugin } from '../../plugins/owned-items';

export function setupBuiltinPlugins(): void {
  pluginManager.registerPlugin(new OwnedItemsPlugin());
}

setupBuiltinPlugins();
