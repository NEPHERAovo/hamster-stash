import type { AdapterResolver, StoredEntity } from '../../types/adapter';
import type { PluginCollection } from './types';
import { STORES } from '../db/schema';
import { BaseRepository } from '../repositories/BaseRepository';

export type { AdapterResolver };

interface PluginDataRecord extends StoredEntity {
  pluginId: string;
  collection: string;
  data: Record<string, unknown>;
}

interface PluginSettingsRecord extends StoredEntity {
  settings: Record<string, unknown>;
}

export class PluginStorageManager {
  private adapterResolver?: AdapterResolver;
  private dataRepo: BaseRepository<PluginDataRecord>;
  private settingsRepo: BaseRepository<PluginSettingsRecord>;

  constructor(adapter?: AdapterResolver) {
    this.adapterResolver = adapter;
    const resolver = () => this.resolveAdapter();
    this.dataRepo = new BaseRepository<PluginDataRecord>(resolver, STORES.PLUGIN_DATA, {
      useTombstone: true,
    });
    this.settingsRepo = new BaseRepository<PluginSettingsRecord>(
      resolver,
      STORES.PLUGIN_SETTINGS,
      { useTombstone: false }
    );
  }

  setAdapter(adapter: AdapterResolver): void {
    this.adapterResolver = adapter;
  }

  private resolveAdapter() {
    const resolved =
      typeof this.adapterResolver === 'function' ? this.adapterResolver() : this.adapterResolver;
    if (!resolved) {
      throw new Error('PluginStorageManager adapter is not configured.');
    }
    return resolved;
  }

  createCollection<T extends { id: string }>(
    pluginId: string,
    collectionName: string
  ): PluginCollection<T> {
    const dataRepo = this.dataRepo;
    const buildKey = (entityId: string) => `${pluginId}_${collectionName}_${entityId}`;

    return {
      async findById(id: string): Promise<T | null> {
        const fullId = buildKey(id);
        const record = await dataRepo.findById(fullId);
        if (!record || record.pluginId !== pluginId || record.collection !== collectionName) {
          return null;
        }
        return { ...record.data, id } as unknown as T;
      },

      async findAll(filter?: Partial<T>): Promise<T[]> {
        const records = await dataRepo.findAll({
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

        await dataRepo.create({
          id: fullId,
          pluginId,
          collection: collectionName,
          data: entity as unknown as Record<string, unknown>,
        });

        return entity;
      },

      async update(id: string, patch: Partial<T>): Promise<T> {
        const fullId = buildKey(id);
        const record = await dataRepo.findById(fullId);
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

        await dataRepo.update(fullId, {
          data: updatedEntity as unknown as Record<string, unknown>,
        });

        return updatedEntity;
      },

      async delete(id: string): Promise<void> {
        const fullId = buildKey(id);
        await dataRepo.delete(fullId);
      },
    };
  }

  createSettingsAccessor(pluginId: string) {
    const settingsRepo = this.settingsRepo;

    return {
      async get<T>(key: string, defaultValue?: T): Promise<T> {
        const record = await settingsRepo.findById(pluginId);
        if (!record || !record.settings || record.settings[key] === undefined) {
          return defaultValue as T;
        }
        return record.settings[key] as T;
      },

      async set<T>(key: string, value: T): Promise<void> {
        const record = await settingsRepo.findById(pluginId);
        const settings = { ...(record?.settings || {}), [key]: value };
        await settingsRepo.upsert(pluginId, { settings });
      },
    };
  }
}
