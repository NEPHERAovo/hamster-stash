import type { DataAdapter } from '../../types/adapter';
import type { PluginCollection } from './types';
import { STORES } from '../db/schema';

interface PluginDataRecord {
  id: string;
  pluginId: string;
  collection: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PluginSettingsRecord {
  id: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class PluginStorageManager {
  private adapter: DataAdapter;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  createCollection<T extends { id: string }>(
    pluginId: string,
    collectionName: string
  ): PluginCollection<T> {
    const adapter = this.adapter;

    const buildKey = (entityId: string) => `${pluginId}_${collectionName}_${entityId}`;

    return {
      async findById(id: string): Promise<T | null> {
        const fullId = buildKey(id);
        const record = await adapter.read<PluginDataRecord>(STORES.PLUGIN_DATA, fullId);
        if (!record || record.pluginId !== pluginId || record.collection !== collectionName) {
          return null;
        }
        return { ...record.data, id } as unknown as T;
      },

      async findAll(filter?: Partial<T>): Promise<T[]> {
        const records = await adapter.query<PluginDataRecord>(STORES.PLUGIN_DATA, {
          filters: {
            pluginId,
            collection: collectionName,
          },
        });

        let list = records.map((r) => {
          const entityId = r.id.replace(`${pluginId}_${collectionName}_`, '');
          return { ...r.data, id: entityId } as unknown as T;
        });

        if (filter) {
          list = list.filter((item) =>
            Object.entries(filter).every(([k, v]) => (item as Record<string, unknown>)[k] === v)
          );
        }

        return list;
      },

      async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<T> {
        const now = new Date().toISOString();
        const entityId = data.id || `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const fullId = buildKey(entityId);

        const entity = {
          ...data,
          id: entityId,
          createdAt: now,
          updatedAt: now,
        } as unknown as T;

        await adapter.create<PluginDataRecord>(STORES.PLUGIN_DATA, {
          id: fullId,
          pluginId,
          collection: collectionName,
          data: entity as unknown as Record<string, unknown>,
        });

        return entity;
      },

      async update(id: string, patch: Partial<T>): Promise<T> {
        const fullId = buildKey(id);
        const record = await adapter.read<PluginDataRecord>(STORES.PLUGIN_DATA, fullId);
        if (!record) {
          throw new Error(`Record ${id} not found in collection ${collectionName}`);
        }

        const now = new Date().toISOString();
        const updatedEntity = {
          ...record.data,
          ...patch,
          id,
          updatedAt: now,
        } as unknown as T;

        await adapter.update<PluginDataRecord>(STORES.PLUGIN_DATA, fullId, {
          data: updatedEntity,
        });

        return updatedEntity;
      },

      async delete(id: string): Promise<void> {
        const fullId = buildKey(id);
        await adapter.delete(STORES.PLUGIN_DATA, fullId);
      },
    };
  }

  createSettingsAccessor(pluginId: string) {
    const adapter = this.adapter;

    return {
      async get<T>(key: string, defaultValue?: T): Promise<T> {
        const record = await adapter.read<PluginSettingsRecord>(STORES.PLUGIN_SETTINGS, pluginId);
        if (!record || !record.settings || record.settings[key] === undefined) {
          return defaultValue as T;
        }
        return record.settings[key] as T;
      },

      async set<T>(key: string, value: T): Promise<void> {
        const record = await adapter.read<PluginSettingsRecord>(STORES.PLUGIN_SETTINGS, pluginId);
        const settings = record?.settings || {};
        settings[key] = value;

        if (record) {
          await adapter.update<PluginSettingsRecord>(STORES.PLUGIN_SETTINGS, pluginId, {
            settings,
          });
        } else {
          await adapter.create<PluginSettingsRecord>(STORES.PLUGIN_SETTINGS, {
            id: pluginId,
            settings,
          });
        }
      },
    };
  }
}
