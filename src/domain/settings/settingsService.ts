import type { SettingsRepository, SettingEntity } from '../../core/repositories/SettingsRepository';
import type { StoredEntity } from '../../types/adapter';

export class SettingsService {
  private settingsRepo: SettingsRepository;

  constructor(settingsRepo: SettingsRepository) {
    this.settingsRepo = settingsRepo;
  }

  async getSetting<T extends StoredEntity>(id: string): Promise<T | null> {
    return this.settingsRepo.getSetting<T>(id);
  }

  async saveSetting<T extends StoredEntity>(
    id: string,
    payload: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<T> {
    return this.settingsRepo.saveSetting<T>(id, payload);
  }

  async patchSetting<T extends StoredEntity>(
    id: string,
    patch: Partial<Omit<T, 'id'>>
  ): Promise<T | null> {
    const existing = await this.settingsRepo.getSetting<T>(id);
    if (!existing) return null;
    return (await this.settingsRepo.update(
      id,
      patch as Partial<Omit<SettingEntity, 'id'>>
    )) as unknown as T;
  }
}
