import { core } from '../../core';
import { attachmentStore, type AttachmentRecord } from '../../core/attachments/attachmentStore';
import { pluginManager } from '../../core/plugin/PluginManager';
import { STORES } from '../../core/db/schema';
import { webdavClient, type WebDavConfig } from './webdavClient';
import {
  buildThreeWaySyncPlan,
  resolveSyncPlan,
  type DiffStats,
  type SyncDiffPlan,
  type SyncResolutionChoice,
} from './diffMerger';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { getLogicalSyncDay, type ConfigType } from '../../utils/date';

export const SYNC_DAY_CUTOFF_HOUR = 6;
export const SYNC_VAULT_FILE = 'hamster_sync_vault.json';
export const SYNC_BASE_SETTING_ID = 'webdav_sync_base';

const LOCAL_ONLY_SETTING_KEYS = new Set<string>(['webdav_config', SYNC_BASE_SETTING_ID]);

export interface WebDavSettingRecord extends StoredEntity {
  id: 'webdav_config';
  config: WebDavConfig;
  lastSyncAt?: string;
  autoSyncDaily?: boolean;
  syncAttachments?: boolean;
  uploadedAttachmentIds?: string[];
}

export interface SyncBaseRecord extends StoredEntity {
  id: typeof SYNC_BASE_SETTING_ID;
  snapshot: ExportData;
}

export interface AutoSyncRunResult {
  ran: boolean;
  success?: boolean;
  changedLocal?: boolean;
  needsReview?: boolean;
  reviewCount?: number;
  uploadedAttachments?: number;
  message?: string;
  error?: string;
}

export interface WebDavSyncPrepareResult {
  status: 'up_to_date' | 'synced' | 'first_backup' | 'needs_review';
  message: string;
  stats?: DiffStats;
  uploadedAttachments?: number;
  plan?: SyncDiffPlan;
  config?: WebDavConfig;
  syncAttachments?: boolean;
}

export interface WebDavSyncCommitResult {
  success: boolean;
  changedLocal: boolean;
  changedRemote: boolean;
  message: string;
  stats: DiffStats;
  uploadedAttachments: number;
}

export function stripInlineVoucherPayloads(data: ExportData): ExportData {
  return {
    ...data,
    transactions: (data.transactions || []).map((tx: Transaction) => {
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

export function sanitizeSyncPayload(data: ExportData): ExportData {
  const withoutVouchers = stripInlineVoucherPayloads(data);
  const cleanSettings: Record<string, unknown> = {};
  if (withoutVouchers.settings) {
    for (const [k, v] of Object.entries(withoutVouchers.settings)) {
      if (LOCAL_ONLY_SETTING_KEYS.has(k)) continue;
      cleanSettings[k] = v;
    }
  }
  return {
    ...withoutVouchers,
    settings: cleanSettings,
  };
}

export class SyncService {
  private pendingAutoSync: Promise<AutoSyncRunResult> | null = null;
  private pendingReviewPlan: {
    plan: SyncDiffPlan;
    config: WebDavConfig;
    syncAttachments: boolean;
  } | null = null;
  private autoSyncReviewSuppressedForSession = false;

  getPendingReview(): {
    plan: SyncDiffPlan;
    config: WebDavConfig;
    syncAttachments: boolean;
  } | null {
    return this.pendingReviewPlan;
  }

  clearPendingReview(): void {
    this.pendingReviewPlan = null;
  }

  async getWebDavConfig(): Promise<{
    config: WebDavConfig | null;
    lastSyncAt?: string;
    autoSyncDaily: boolean;
    syncAttachments: boolean;
    uploadedAttachmentIds: string[];
  }> {
    await core.init();
    try {
      const record = await core.adapter.read<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config');
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
    const existing = await core.adapter.read<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config', {
        config,
        ...(options?.autoSyncDaily !== undefined ? { autoSyncDaily: options.autoSyncDaily } : {}),
        ...(options?.syncAttachments !== undefined
          ? { syncAttachments: options.syncAttachments }
          : {}),
      });
    } else {
      await core.adapter.create<WebDavSettingRecord>(STORES.SETTINGS, {
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
    const existing = await core.adapter.read<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config', {
        autoSyncDaily: enabled,
      });
      return;
    }
    await core.adapter.create<WebDavSettingRecord>(STORES.SETTINGS, {
      id: 'webdav_config',
      config: { url: '', username: '', password: '' },
      autoSyncDaily: enabled,
      syncAttachments: false,
      uploadedAttachmentIds: [],
    });
  }

  async setSyncAttachments(enabled: boolean): Promise<void> {
    await core.init();
    const existing = await core.adapter.read<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config');
    if (existing) {
      await core.adapter.update<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config', {
        syncAttachments: enabled,
      });
      return;
    }
    await core.adapter.create<WebDavSettingRecord>(STORES.SETTINGS, {
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
    now: ConfigType = new Date()
  ): boolean {
    if (!autoSyncDaily) return false;
    if (!config || !config.url.trim() || !config.username.trim() || !config.password.trim()) {
      return false;
    }
    if (!lastSyncAt) return true;
    const currentLogicalDay =
      typeof now === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(now)
        ? now
        : getLogicalSyncDay(now, SYNC_DAY_CUTOFF_HOUR);
    const lastLogicalDay = getLogicalSyncDay(lastSyncAt, SYNC_DAY_CUTOFF_HOUR);
    return lastLogicalDay !== currentLogicalDay;
  }

  async runAutoSyncIfNeeded(callbacks?: { onStart?: () => void }): Promise<AutoSyncRunResult> {
    if (this.autoSyncReviewSuppressedForSession) {
      return { ran: false };
    }
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
        const prep = await this.prepareWebDavSync(config!);
        if (prep.status === 'needs_review' && prep.plan) {
          this.autoSyncReviewSuppressedForSession = true;
          this.pendingReviewPlan = {
            plan: prep.plan,
            config: prep.config!,
            syncAttachments: Boolean(prep.syncAttachments),
          };
          return {
            ran: true,
            success: true,
            needsReview: true,
            reviewCount: prep.plan.incomingItems.length + prep.plan.conflictItems.length,
            message: prep.message,
          };
        }
        const localChanges = prep.stats
          ? prep.stats.addedLocal + prep.stats.updatedLocal + prep.stats.deletedLocal
          : 0;
        return {
          ran: true,
          success: true,
          changedLocal: localChanges > 0,
          uploadedAttachments: prep.uploadedAttachments || 0,
          message: prep.message,
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
      const existing = await core.adapter.read<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config');
      if (existing) {
        await core.adapter.update<WebDavSettingRecord>(STORES.SETTINGS, 'webdav_config', patch);
      }
    } catch {
      void 0;
    }
  }

  private async getBaseSnapshot(): Promise<ExportData | null> {
    try {
      const record = await core.adapter.read<SyncBaseRecord>(STORES.SETTINGS, SYNC_BASE_SETTING_ID);
      if (record?.snapshot) {
        return sanitizeSyncPayload(record.snapshot);
      }
    } catch {
      void 0;
    }
    return null;
  }

  private async saveBaseSnapshot(snapshot: ExportData): Promise<void> {
    const cleanSnapshot = sanitizeSyncPayload(snapshot);
    const existing = await core.adapter.read<SyncBaseRecord>(STORES.SETTINGS, SYNC_BASE_SETTING_ID);
    if (existing) {
      await core.adapter.update<SyncBaseRecord>(STORES.SETTINGS, SYNC_BASE_SETTING_ID, {
        snapshot: cleanSnapshot,
      });
    } else {
      await core.adapter.create<SyncBaseRecord>(STORES.SETTINGS, {
        id: SYNC_BASE_SETTING_ID,
        snapshot: cleanSnapshot,
      });
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
      if (tx.voucher?.attachmentId && !(tx as StoredEntity).deletedAt) {
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

  private resolveValidatedConfig(customConfig?: WebDavConfig): WebDavConfig {
    if (!customConfig) {
      throw new Error('未配置 WebDAV 服务器信息，请先设置');
    }
    if (!customConfig.url || !customConfig.username || !customConfig.password) {
      throw new Error('WebDAV 服务器地址、账号或密码不能为空');
    }
    return customConfig;
  }

  async prepareWebDavSync(
    customConfig?: WebDavConfig,
    options?: { syncAttachments?: boolean }
  ): Promise<WebDavSyncPrepareResult> {
    await core.init();
    const stored = await this.getWebDavConfig();
    const config = this.resolveValidatedConfig(customConfig || stored.config || undefined);
    const shouldBackupAttachments = options?.syncAttachments ?? stored.syncAttachments;

    const rawLocalData = await core.adapter.export({ includeTombstones: true });
    const localData = sanitizeSyncPayload(rawLocalData);
    const remoteContent = await webdavClient.fetchFile(config, SYNC_VAULT_FILE);
    const now = new Date().toISOString();

    if (!remoteContent) {
      await webdavClient.putFile(config, SYNC_VAULT_FILE, JSON.stringify(localData, null, 2));
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
      await this.saveBaseSnapshot(localData);
      await this.recordSyncMetadata({
        lastSyncAt: now,
        uploadedAttachmentIds: nextUploadedIds,
      });
      this.pendingReviewPlan = null;
      this.autoSyncReviewSuppressedForSession = false;
      return {
        status: 'first_backup',
        uploadedAttachments,
        message:
          uploadedAttachments > 0
            ? `首次备份成功，已上传账本及 ${uploadedAttachments} 个凭证附件`
            : '首次备份成功，已上传账本数据到云端',
      };
    }

    let remoteRaw: ExportData;
    try {
      remoteRaw = JSON.parse(remoteContent) as ExportData;
    } catch {
      throw new Error('解析云端数据失败，请确认远端文件完整性');
    }

    const remoteData = sanitizeSyncPayload(remoteRaw);
    const baseData = await this.getBaseSnapshot();
    const plan = buildThreeWaySyncPlan(localData, remoteData, baseData);

    if (plan.isStrictlyEqual) {
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
      await this.saveBaseSnapshot(localData);
      await this.recordSyncMetadata({
        lastSyncAt: now,
        uploadedAttachmentIds: nextUploadedIds,
      });
      this.pendingReviewPlan = null;
      this.autoSyncReviewSuppressedForSession = false;
      const attSuffix =
        uploadedAttachments > 0 ? `，另备份 ${uploadedAttachments} 个凭证附件` : '';
      return {
        status: 'up_to_date',
        uploadedAttachments,
        message: `同步完成：数据已是最新${attSuffix}`,
      };
    }

    if (!plan.requiresReview) {
      const committed = await this.commitWebDavSync(plan, {}, config, {
        syncAttachments: shouldBackupAttachments,
      });
      return {
        status: 'synced',
        message: committed.message,
        stats: committed.stats,
        uploadedAttachments: committed.uploadedAttachments,
      };
    }

    const totalNeedConfirm = plan.incomingItems.length + plan.conflictItems.length;
    this.pendingReviewPlan = {
      plan,
      config,
      syncAttachments: shouldBackupAttachments,
    };

    return {
      status: 'needs_review',
      plan,
      config,
      syncAttachments: shouldBackupAttachments,
      message: `检测到 ${totalNeedConfirm} 项云端下发或差异变更，请确认合并方式`,
    };
  }

  async commitWebDavSync(
    plan: SyncDiffPlan,
    resolutions: Record<string, SyncResolutionChoice> = {},
    customConfig?: WebDavConfig,
    options?: { syncAttachments?: boolean }
  ): Promise<WebDavSyncCommitResult> {
    await core.init();
    const stored = await this.getWebDavConfig();
    const config = this.resolveValidatedConfig(customConfig || stored.config || undefined);
    const shouldBackupAttachments = options?.syncAttachments ?? stored.syncAttachments;
    const now = new Date().toISOString();

    const mergeResult = resolveSyncPlan(plan, resolutions, {
      retainTombstones: true,
      nowIso: now,
    });
    const cleanMerged = sanitizeSyncPayload(mergeResult.merged);

    if (mergeResult.changedLocal) {
      const preservedLocalSettings: Record<string, unknown> = {
        ...(cleanMerged.settings || {}),
      };
      for (const key of LOCAL_ONLY_SETTING_KEYS) {
        const localRec = await core.adapter.read<StoredEntity>(STORES.SETTINGS, key);
        if (localRec) {
          preservedLocalSettings[key] = localRec;
        }
      }
      await core.adapter.import({
        ...cleanMerged,
        settings: preservedLocalSettings,
      });
      pluginManager.emitHostEvent('data:imported');
    }

    if (mergeResult.changedRemote) {
      await webdavClient.putFile(config, SYNC_VAULT_FILE, JSON.stringify(cleanMerged, null, 2));
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

    await this.saveBaseSnapshot(cleanMerged);
    await this.recordSyncMetadata({
      lastSyncAt: now,
      uploadedAttachmentIds: nextUploadedIds,
    });
    this.pendingReviewPlan = null;
    this.autoSyncReviewSuppressedForSession = false;

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
      changedLocal: mergeResult.changedLocal,
      changedRemote: mergeResult.changedRemote,
      message,
      stats: mergeResult.stats,
      uploadedAttachments,
    };
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
    const prep = await this.prepareWebDavSync(customConfig, options);
    if (prep.status === 'needs_review' && prep.plan) {
      const committed = await this.commitWebDavSync(prep.plan, {}, prep.config, options);
      return {
        success: true,
        message: committed.message,
        stats: committed.stats,
        uploadedAttachments: committed.uploadedAttachments,
      };
    }
    return {
      success: true,
      message: prep.message,
      stats: prep.stats,
      uploadedAttachments: prep.uploadedAttachments,
    };
  }
}

export const syncService = new SyncService();
