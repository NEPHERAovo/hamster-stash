import { STORES } from '../db/schema';
import type { AdapterResolver, StoredEntity } from '../../types/adapter';
import { BaseRepository } from './BaseRepository';

export type SettingEntity = StoredEntity & Record<string, unknown>;

export class SettingsRepository extends BaseRepository<SettingEntity> {
  constructor(adapterResolver: AdapterResolver) {
    super(adapterResolver, STORES.SETTINGS, {
      useTombstone: false,
    });
  }

  async getSetting<T extends StoredEntity>(id: string): Promise<T | null> {
    return (await this.findById(id)) as unknown as T | null;
  }

  async saveSetting<T extends StoredEntity>(
    id: string,
    payload: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<T> {
    return (await this.upsert(
      id,
      payload as Omit<SettingEntity, 'id' | 'createdAt' | 'updatedAt'>
    )) as unknown as T;
  }
}
