import { core } from '../../core';
import { webdavClient, type WebDavConfig } from './webdavClient';
import { mergeSyncPayloads, type DiffStats } from './diffMerger';
import type { ExportData, StoredEntity } from '../../types/adapter';

export interface WebDavSettingRecord extends StoredEntity {
  id: 'webdav_config';
  config: WebDavConfig;
  lastSyncAt?: string;
}

export class SyncService {
  async getWebDavConfig(): Promise<{ config: WebDavConfig | null; lastSyncAt?: string }> {
    await core.init();
    try {
      const record = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
      if (record && record.config) {
        return { config: record.config, lastSyncAt: record.lastSyncAt };
      }
    } catch {
      void 0;
    }
    return { config: null };
  }

  async saveWebDavConfig(config: WebDavConfig): Promise<void> {
    await core.init();
    const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', {
        config,
      });
    } else {
      await core.adapter.create<WebDavSettingRecord>('settings', {
        id: 'webdav_config',
        config,
      });
    }
  }

  async recordSyncTimestamp(timestamp: string): Promise<void> {
    try {
      const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
      if (existing) {
        await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', {
          lastSyncAt: timestamp,
        });
      }
    } catch {
      void 0;
    }
  }

  async syncWithWebDav(customConfig?: WebDavConfig): Promise<{
    success: boolean;
    message: string;
    stats?: DiffStats;
  }> {
    await core.init();
    let config = customConfig;
    if (!config) {
      const stored = await this.getWebDavConfig();
      if (!stored.config) {
        throw new Error('未配置 WebDAV 服务器信息，请先设置');
      }
      config = stored.config;
    }

    if (!config.url || !config.username || !config.password) {
      throw new Error('WebDAV 服务器地址、账号或密码不能为空');
    }

    const localData = await core.adapter.export();
    const remoteContent = await webdavClient.fetchFile(config, 'hamster_sync_vault.json');

    const now = new Date().toISOString();

    if (!remoteContent) {
      await webdavClient.putFile(config, 'hamster_sync_vault.json', JSON.stringify(localData, null, 2));
      await this.recordSyncTimestamp(now);
      return {
        success: true,
        message: '首次备份成功，已上传全量数据到云端',
      };
    }

    let remoteData: ExportData;
    try {
      remoteData = JSON.parse(remoteContent) as ExportData;
    } catch {
      throw new Error('解析云端数据失败，请确认远端文件完整性');
    }

    const mergeResult = mergeSyncPayloads(localData, remoteData);

    if (mergeResult.changedLocal) {
      await core.adapter.import(mergeResult.merged);
    }

    if (mergeResult.changedRemote || !mergeResult.changedLocal) {
      await webdavClient.putFile(
        config,
        'hamster_sync_vault.json',
        JSON.stringify(mergeResult.merged, null, 2)
      );
    }

    await this.recordSyncTimestamp(now);

    const localChanges = mergeResult.stats.addedLocal + mergeResult.stats.updatedLocal + mergeResult.stats.deletedLocal;
    const remoteChanges = mergeResult.stats.addedRemote + mergeResult.stats.updatedRemote + mergeResult.stats.deletedRemote;

    let message = '同步完成：数据已是最新';
    if (localChanges > 0 || remoteChanges > 0) {
      message = `同步完成：本地合并 ${localChanges} 项，云端更新 ${remoteChanges} 项`;
    }

    return {
      success: true,
      message,
      stats: mergeResult.stats,
    };
  }
}

export const syncService = new SyncService();
