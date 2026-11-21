import { core } from '../../core';
import { attachmentStore, type AttachmentRecord } from '../../core/attachments/attachmentStore';
import { webdavClient, type WebDavConfig } from './webdavClient';
import { mergeSyncPayloads, type DiffStats } from './diffMerger';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { formatDate, todayDate } from '../../utils/date';

export interface WebDavSettingRecord extends StoredEntity {
  id: 'webdav_config';
  config: WebDavConfig;
  lastSyncAt?: string;
  autoSyncDaily?: boolean;
  syncAttachments?: boolean;
  uploadedAttachmentIds?: string[];
}

export interface AutoSyncRunResult {
  ran: boolean;
  success?: boolean;
  changedLocal?: boolean;
  uploadedAttachments?: number;
  message?: string;
  error?: string;
}

export function stripInlineVoucherPayloads(data: ExportData): ExportData {
  return {
    ...data,
    transactions: data.transactions.map((tx: Transaction) => {
      if (!tx.voucher || !tx.voucher.fileUrl) return tx;
      const voucherCopy = { ...tx.voucher };
      delete voucherCopy.fileUrl;
      return {
        ...tx,
        voucher: voucherCopy,
      };
    }),
  };
}

export class SyncService {
  private pendingAutoSync: Promise<AutoSyncRunResult> | null = null;

  async getWebDavConfig(): Promise<{
    config: WebDavConfig | null;
    lastSyncAt?: string;
    autoSyncDaily: boolean;
    syncAttachments: boolean;
    uploadedAttachmentIds: string[];
  }> {
    await core.init();
    try {
      const record = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
      if (record && record.config) {
        return {
          config: record.config,
          lastSyncAt: record.lastSyncAt,
          autoSyncDaily: Boolean(record.autoSyncDaily),
          syncAttachments: Boolean(record.syncAttachments),
          uploadedAttachmentIds: Array.isArray(record.uploadedAttachmentIds)
            ? record.uploadedAttachmentIds
            : [],
        };
      }
    } catch {
      void 0;
    }
    return {
      config: null,
      autoSyncDaily: false,
      syncAttachments: false,
      uploadedAttachmentIds: [],
    };
  }

  async saveWebDavConfig(
    config: WebDavConfig,
    options?: { autoSyncDaily?: boolean; syncAttachments?: boolean }
  ): Promise<void> {
    await core.init();
    const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', {
        config,
        ...(options?.autoSyncDaily !== undefined ? { autoSyncDaily: options.autoSyncDaily } : {}),
        ...(options?.syncAttachments !== undefined
          ? { syncAttachments: options.syncAttachments }
          : {}),
      });
    } else {
      await core.adapter.create<WebDavSettingRecord>('settings', {
        id: 'webdav_config',
        config,
        autoSyncDaily: Boolean(options?.autoSyncDaily),
        syncAttachments: Boolean(options?.syncAttachments),
        uploadedAttachmentIds: [],
      });
    }
  }

  async setAutoSyncDaily(enabled: boolean): Promise<void> {
    await core.init();
    const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', {
        autoSyncDaily: enabled,
      });
      return;
    }
    await core.adapter.create<WebDavSettingRecord>('settings', {
      id: 'webdav_config',
      config: { url: '', username: '', password: '' },
      autoSyncDaily: enabled,
      syncAttachments: false,
      uploadedAttachmentIds: [],
    });
  }

  async setSyncAttachments(enabled: boolean): Promise<void> {
    await core.init();
    const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', {
        syncAttachments: enabled,
      });
      return;
    }
    await core.adapter.create<WebDavSettingRecord>('settings', {
      id: 'webdav_config',
      config: { url: '', username: '', password: '' },
      autoSyncDaily: false,
      syncAttachments: enabled,
      uploadedAttachmentIds: [],
    });
  }

  shouldRunDailyAutoSync(
    config: WebDavConfig | null,
    autoSyncDaily: boolean,
    lastSyncAt?: string,
    today: string = todayDate()
  ): boolean {
    if (!autoSyncDaily) return false;
    if (!config || !config.url.trim() || !config.username.trim() || !config.password.trim()) {
      return false;
    }
    if (!lastSyncAt) return true;
    return formatDate(lastSyncAt) !== today;
  }

  async runAutoSyncIfNeeded(callbacks?: { onStart?: () => void }): Promise<AutoSyncRunResult> {
    if (this.pendingAutoSync) {
      return this.pendingAutoSync;
    }

    this.pendingAutoSync = (async () => {
      try {
        const { config, lastSyncAt, autoSyncDaily } = await this.getWebDavConfig();
        if (!this.shouldRunDailyAutoSync(config, autoSyncDaily, lastSyncAt)) {
          return { ran: false };
        }
        callbacks?.onStart?.();
        const res = await this.syncWithWebDav(config!);
        const localChanges = res.stats
          ? res.stats.addedLocal + res.stats.updatedLocal + res.stats.deletedLocal
          : 0;
        return {
          ran: true,
          success: true,
          changedLocal: localChanges > 0,
          uploadedAttachments: res.uploadedAttachments || 0,
          message: res.message,
        };
      } catch (err) {
        return {
          ran: true,
          success: false,
          error: err instanceof Error ? err.message : '自动同步失败',
        };
      } finally {
        this.pendingAutoSync = null;
      }
    })();

    return this.pendingAutoSync;
  }

  async recordSyncMetadata(patch: {
    lastSyncAt?: string;
    uploadedAttachmentIds?: string[];
  }): Promise<void> {
    try {
      const existing = await core.adapter.read<WebDavSettingRecord>('settings', 'webdav_config');
      if (existing) {
        await core.adapter.update<WebDavSettingRecord>('settings', 'webdav_config', patch);
      }
    } catch {
      void 0;
    }
  }

  private async backupMissingAttachments(
    config: WebDavConfig,
    transactions: Transaction[],
    alreadyUploaded: string[]
  ): Promise<{ uploadedCount: number; nextUploadedIds: string[] }> {
    const uploadedSet = new Set(alreadyUploaded);
    const referencedIds = new Set<string>();
    for (const tx of transactions) {
      if (tx.voucher?.attachmentId) {
        referencedIds.add(tx.voucher.attachmentId);
      }
    }

    let uploadedCount = 0;
    for (const attId of referencedIds) {
      if (uploadedSet.has(attId)) continue;
      const local = await attachmentStore.getAttachment(attId);
      if (!local?.dataUrl) continue;

      const remotePath = `attachments/${attId}.json`;
      const existsRemote = await webdavClient.fileExists(config, remotePath);
      if (!existsRemote) {
        await webdavClient.putFile(
          config,
          remotePath,
          JSON.stringify({
            id: local.id,
            name: local.name,
            mimeType: local.mimeType,
            size: local.size,
            dataUrl: local.dataUrl,
          })
        );
        uploadedCount++;
      }
      uploadedSet.add(attId);
    }

    return {
      uploadedCount,
      nextUploadedIds: Array.from(uploadedSet),
    };
  }

  async fetchAttachmentFromWebDav(attachmentId: string): Promise<string | null> {
    const { config } = await this.getWebDavConfig();
    if (!config || !config.url || !config.username || !config.password) {
      return null;
    }
    try {
      const content = await webdavClient.fetchFile(config, `attachments/${attachmentId}.json`);
      if (!content) return null;
      const parsed = JSON.parse(content) as Partial<AttachmentRecord>;
      if (!parsed.dataUrl) return null;
      await attachmentStore.saveAttachment({
        id: attachmentId,
        name: parsed.name || attachmentId,
        mimeType: parsed.mimeType || 'image/jpeg',
        size: parsed.size || '',
        dataUrl: parsed.dataUrl,
      });
      return parsed.dataUrl;
    } catch {
      return null;
    }
  }

  async syncWithWebDav(
    customConfig?: WebDavConfig,
    options?: { syncAttachments?: boolean }
  ): Promise<{
    success: boolean;
    message: string;
    stats?: DiffStats;
    uploadedAttachments?: number;
  }> {
    await core.init();
    const stored = await this.getWebDavConfig();
    const config = customConfig || stored.config;
    if (!config) {
      throw new Error('未配置 WebDAV 服务器信息，请先设置');
    }
    if (!config.url || !config.username || !config.password) {
      throw new Error('WebDAV 服务器地址、账号或密码不能为空');
    }

    const shouldBackupAttachments = options?.syncAttachments ?? stored.syncAttachments;

    const rawLocalData = await core.adapter.export();
    const localData = stripInlineVoucherPayloads(rawLocalData);

    const remoteContent = await webdavClient.fetchFile(config, 'hamster_sync_vault.json');
    const now = new Date().toISOString();

    if (!remoteContent) {
      await webdavClient.putFile(config, 'hamster_sync_vault.json', JSON.stringify(localData, null, 2));
      let uploadedAttachments = 0;
      let nextUploadedIds = stored.uploadedAttachmentIds;
      if (shouldBackupAttachments) {
        const res = await this.backupMissingAttachments(
          config,
          localData.transactions,
          stored.uploadedAttachmentIds
        );
        uploadedAttachments = res.uploadedCount;
        nextUploadedIds = res.nextUploadedIds;
      }
      await this.recordSyncMetadata({
        lastSyncAt: now,
        uploadedAttachmentIds: nextUploadedIds,
      });
      return {
        success: true,
        uploadedAttachments,
        message:
          uploadedAttachments > 0
            ? `首次备份成功，已上传账本及 ${uploadedAttachments} 个凭证附件`
            : '首次备份成功，已上传账本数据到云端',
      };
    }

    let remoteData: ExportData;
    try {
      remoteData = JSON.parse(remoteContent) as ExportData;
    } catch {
      throw new Error('解析云端数据失败，请确认远端文件完整性');
    }

    const mergeResult = mergeSyncPayloads(localData, stripInlineVoucherPayloads(remoteData));

    if (mergeResult.changedLocal) {
      await core.adapter.import(mergeResult.merged);
    }

    const cleanMerged = stripInlineVoucherPayloads(mergeResult.merged);
    if (mergeResult.changedRemote || !mergeResult.changedLocal) {
      await webdavClient.putFile(
        config,
        'hamster_sync_vault.json',
        JSON.stringify(cleanMerged, null, 2)
      );
    }

    let uploadedAttachments = 0;
    let nextUploadedIds = stored.uploadedAttachmentIds;
    if (shouldBackupAttachments) {
      const res = await this.backupMissingAttachments(
        config,
        cleanMerged.transactions,
        stored.uploadedAttachmentIds
      );
      uploadedAttachments = res.uploadedCount;
      nextUploadedIds = res.nextUploadedIds;
    }

    await this.recordSyncMetadata({
      lastSyncAt: now,
      uploadedAttachmentIds: nextUploadedIds,
    });

    const localChanges =
      mergeResult.stats.addedLocal + mergeResult.stats.updatedLocal + mergeResult.stats.deletedLocal;
    const remoteChanges =
      mergeResult.stats.addedRemote + mergeResult.stats.updatedRemote + mergeResult.stats.deletedRemote;

    const attachmentSuffix =
      uploadedAttachments > 0 ? `，另备份 ${uploadedAttachments} 个凭证附件` : '';

    let message = `同步完成：数据已是最新${attachmentSuffix}`;
    if (localChanges > 0 || remoteChanges > 0) {
      message = `同步完成：本地合并 ${localChanges} 项，云端更新 ${remoteChanges} 项${attachmentSuffix}`;
    }

    return {
      success: true,
      message,
      stats: mergeResult.stats,
      uploadedAttachments,
    };
  }
}

export const syncService = new SyncService();
