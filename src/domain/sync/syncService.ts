import type { AttachmentRecord, AttachmentStore } from '../../core/attachments/attachmentStore';
import type { SettingsService } from '../settings/settingsService';
import type { DataLifecycleService } from '../data/dataLifecycleService';
import { webdavClient, type WebDavConfig } from './webdavClient';
import {
  areValuesCanonicallyEqual,
  buildThreeWaySyncPlan,
  resolveSyncPlan,
  type DiffStats,
  type SyncDiffPlan,
  type SyncResolutionChoice,
} from './diffMerger';
import {
  assembleExportDataFromShards,
  extractCachedShardsFromExport,
  isValidSyncManifest,
  serializeExportDataToShards,
  SYNC_MANIFEST_FILE,
  SYNC_MANIFEST_VERSION,
  SYNC_META_FILE,
  SYNC_SETTINGS_FILE,
  type MetaShard,
  type SerializedSyncShards,
  type SettingsShard,
  type SyncManifest,
} from './syncShards';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { getLogicalSyncDay, type ConfigType } from '../../utils/date';

export {
  SYNC_MANIFEST_FILE,
  SYNC_MANIFEST_VERSION,
  SYNC_META_FILE,
  SYNC_SETTINGS_FILE,
} from './syncShards';

export const SYNC_DAY_CUTOFF_HOUR = 6;
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
  version: typeof SYNC_MANIFEST_VERSION;
  shardHashes: Record<string, string>;
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

export interface SyncServiceDeps {
  ensureReady?: () => Promise<void>;
  settingsService?: SettingsService;
  dataLifecycleService?: DataLifecycleService;
  attachmentStore?: AttachmentStore;
  onDataImported?: () => void;
}

export function stripInlineVoucherPayloads(data: ExportData): ExportData {
  return {
    ...data,
    transactions: (data.transactions || []).map((tx: Transaction) => {
      if (!tx.voucher?.fileUrl) return tx;
      const voucherCopy = { ...tx.voucher };
      delete voucherCopy.fileUrl;
      return { ...tx, voucher: voucherCopy };
    }),
  };
}

export function sanitizeSyncPayload(data: ExportData): ExportData {
  const withoutVouchers = stripInlineVoucherPayloads(data);
  const cleanSettings: Record<string, unknown> = {};
  if (withoutVouchers.settings) {
    for (const [k, v] of Object.entries(withoutVouchers.settings)) {
      if (!LOCAL_ONLY_SETTING_KEYS.has(k)) cleanSettings[k] = v;
    }
  }
  return { ...withoutVouchers, settings: cleanSettings };
}

export class SyncService {
  private deps: SyncServiceDeps;
  private pendingAutoSync: Promise<AutoSyncRunResult> | null = null;
  private pendingReviewPlan: {
    plan: SyncDiffPlan;
    config: WebDavConfig;
    syncAttachments: boolean;
    remoteShardHashes?: Record<string, string>;
  } | null = null;
  private autoSyncReviewSuppressedForSession = false;

  constructor(deps: SyncServiceDeps = {}) {
    this.deps = deps;
  }

  configure(deps: SyncServiceDeps): void {
    this.deps = { ...this.deps, ...deps };
  }

  private get settingsService(): SettingsService {
    if (!this.deps.settingsService) throw new Error('SyncService settingsService is not configured.');
    return this.deps.settingsService;
  }

  private get dataLifecycleService(): DataLifecycleService {
    if (!this.deps.dataLifecycleService) throw new Error('SyncService dataLifecycleService is not configured.');
    return this.deps.dataLifecycleService;
  }

  private async ensureReady(): Promise<void> {
    if (this.deps.ensureReady) await this.deps.ensureReady();
  }

  getPendingReview(): {
    plan: SyncDiffPlan;
    config: WebDavConfig;
    syncAttachments: boolean;
  } | null {
    if (!this.pendingReviewPlan) return null;
    const { plan, config, syncAttachments } = this.pendingReviewPlan;
    return { plan, config, syncAttachments };
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
    await this.ensureReady();
    try {
      const record = await this.settingsService.getSetting<WebDavSettingRecord>('webdav_config');
      if (record?.config) {
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
    return { config: null, autoSyncDaily: false, syncAttachments: false, uploadedAttachmentIds: [] };
  }

  private async upsertWebDavSetting(
    patch: Partial<Omit<WebDavSettingRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await this.ensureReady();
    const existing = await this.settingsService.getSetting<WebDavSettingRecord>('webdav_config');
    if (existing) {
      await this.settingsService.patchSetting<WebDavSettingRecord>('webdav_config', patch);
      return;
    }
    await this.settingsService.saveSetting<WebDavSettingRecord>('webdav_config', {
      config: { url: '', username: '', password: '' },
      autoSyncDaily: false,
      syncAttachments: false,
      uploadedAttachmentIds: [],
      ...patch,
    });
  }

  async saveWebDavConfig(
    config: WebDavConfig,
    options?: { autoSyncDaily?: boolean; syncAttachments?: boolean }
  ): Promise<void> {
    await this.upsertWebDavSetting({
      config,
      ...(options?.autoSyncDaily !== undefined ? { autoSyncDaily: options.autoSyncDaily } : {}),
      ...(options?.syncAttachments !== undefined ? { syncAttachments: options.syncAttachments } : {}),
    });
  }

  async setAutoSyncDaily(enabled: boolean): Promise<void> {
    await this.upsertWebDavSetting({ autoSyncDaily: enabled });
  }

  async setSyncAttachments(enabled: boolean): Promise<void> {
    await this.upsertWebDavSetting({ syncAttachments: enabled });
  }

  shouldRunDailyAutoSync(
    config: WebDavConfig | null,
    autoSyncDaily: boolean,
    lastSyncAt?: string,
    now: ConfigType = new Date()
  ): boolean {
    if (!autoSyncDaily || !config?.url.trim() || !config.username.trim() || !config.password.trim()) {
      return false;
    }
    if (!lastSyncAt) return true;
    const currentLogicalDay =
      typeof now === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(now)
        ? now
        : getLogicalSyncDay(now, SYNC_DAY_CUTOFF_HOUR);
    return getLogicalSyncDay(lastSyncAt, SYNC_DAY_CUTOFF_HOUR) !== currentLogicalDay;
  }

  async runAutoSyncIfNeeded(callbacks?: { onStart?: () => void }): Promise<AutoSyncRunResult> {
    if (this.autoSyncReviewSuppressedForSession) return { ran: false };
    if (this.pendingAutoSync) return this.pendingAutoSync;

    this.pendingAutoSync = (async () => {
      try {
        const { config, lastSyncAt, autoSyncDaily } = await this.getWebDavConfig();
        if (!this.shouldRunDailyAutoSync(config, autoSyncDaily, lastSyncAt)) return { ran: false };
        callbacks?.onStart?.();
        const prep = await this.prepareWebDavSync(config!);
        if (prep.status === 'needs_review' && prep.plan) {
          this.autoSyncReviewSuppressedForSession = true;
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
      await this.settingsService.patchSetting<WebDavSettingRecord>('webdav_config', patch);
    } catch {
      void 0;
    }
  }

  private async getBaseRecord(): Promise<SyncBaseRecord | null> {
    try {
      const record = await this.settingsService.getSetting<SyncBaseRecord>(SYNC_BASE_SETTING_ID);
      if (record?.version === SYNC_MANIFEST_VERSION && record.snapshot && record.shardHashes) {
        return { ...record, snapshot: sanitizeSyncPayload(record.snapshot) };
      }
    } catch {
      void 0;
    }
    return null;
  }

  private async uploadChangedShards(
    config: WebDavConfig,
    serialized: SerializedSyncShards,
    nowIso: string,
    remoteShardHashes?: Record<string, string>
  ): Promise<void> {
    for (const [path, content] of serialized.shards.entries()) {
      if (remoteShardHashes?.[path] === serialized.hashes[path]) continue;
      await webdavClient.putFile(config, path, content);
    }
    const manifest: SyncManifest = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: nowIso,
      files: serialized.hashes,
    };
    await webdavClient.putFile(config, SYNC_MANIFEST_FILE, JSON.stringify(manifest));
  }

  private async fetchRemoteExportData(
    config: WebDavConfig,
    remoteManifest: SyncManifest,
    baseRecord: SyncBaseRecord | null
  ): Promise<ExportData> {
    const cachedShards = baseRecord
      ? extractCachedShardsFromExport(baseRecord.snapshot)
      : new Map<string, unknown>();

    let settingsShard: Partial<SettingsShard> | undefined;
    let metaShard: Partial<MetaShard> | undefined;
    const txShards: Transaction[][] = [];

    for (const [path, remoteHash] of Object.entries(remoteManifest.files)) {
      let parsed: unknown;
      if (baseRecord?.shardHashes[path] === remoteHash && cachedShards.has(path)) {
        parsed = cachedShards.get(path);
      } else {
        const raw = await webdavClient.fetchFile(config, path);
        if (!raw) throw new Error('云端分片文件缺失，请检查云端目录完整性');
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error('解析云端分片数据失败，请确认远端文件完整性');
        }
      }

      if (path === SYNC_SETTINGS_FILE) {
        settingsShard = parsed as Partial<SettingsShard>;
      } else if (path === SYNC_META_FILE) {
        metaShard = parsed as Partial<MetaShard>;
      } else if (path.startsWith('transactions/')) {
        if (!Array.isArray(parsed)) throw new Error('解析云端账单分片格式无效');
        txShards.push(parsed as Transaction[]);
      }
    }

    return sanitizeSyncPayload(assembleExportDataFromShards(settingsShard, metaShard, txShards));
  }

  private async backupMissingAttachments(
    config: WebDavConfig,
    transactions: Transaction[],
    alreadyUploaded: string[]
  ): Promise<{ uploadedCount: number; nextUploadedIds: string[] }> {
    const uploadedSet = new Set(alreadyUploaded);
    const store = this.deps.attachmentStore;
    if (!store) return { uploadedCount: 0, nextUploadedIds: Array.from(uploadedSet) };

    const referencedIds = new Set<string>();
    for (const tx of transactions) {
      if (tx.voucher?.attachmentId && !(tx as StoredEntity).deletedAt) {
        referencedIds.add(tx.voucher.attachmentId);
      }
    }

    let uploadedCount = 0;
    for (const attId of referencedIds) {
      if (uploadedSet.has(attId)) continue;
      const local = await store.getAttachment(attId);
      if (!local?.dataUrl) continue;
      const remotePath = `attachments/${attId}.json`;
      if (!(await webdavClient.fileExists(config, remotePath))) {
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

    return { uploadedCount, nextUploadedIds: Array.from(uploadedSet) };
  }

  private async finalizeSyncState(params: {
    config: WebDavConfig;
    transactions: Transaction[];
    shouldBackupAttachments: boolean;
    uploadedAttachmentIds: string[];
    nowIso: string;
    baseSnapshot?: { data: ExportData; shardHashes: Record<string, string> };
  }): Promise<number> {
    let uploadedCount = 0;
    let nextUploadedIds = params.uploadedAttachmentIds;
    if (params.shouldBackupAttachments) {
      const res = await this.backupMissingAttachments(
        params.config,
        params.transactions,
        params.uploadedAttachmentIds
      );
      uploadedCount = res.uploadedCount;
      nextUploadedIds = res.nextUploadedIds;
    }
    if (params.baseSnapshot) {
      await this.settingsService.saveSetting<SyncBaseRecord>(SYNC_BASE_SETTING_ID, {
        version: SYNC_MANIFEST_VERSION,
        shardHashes: params.baseSnapshot.shardHashes,
        snapshot: sanitizeSyncPayload(params.baseSnapshot.data),
      });
    }
    await this.recordSyncMetadata({
      lastSyncAt: params.nowIso,
      uploadedAttachmentIds: nextUploadedIds,
    });
    this.pendingReviewPlan = null;
    this.autoSyncReviewSuppressedForSession = false;
    return uploadedCount;
  }

  async fetchAttachmentFromWebDav(attachmentId: string): Promise<string | null> {
    const { config } = await this.getWebDavConfig();
    const store = this.deps.attachmentStore;
    if (!config?.url || !config.username || !config.password || !store) return null;

    try {
      const content = await webdavClient.fetchFile(config, `attachments/${attachmentId}.json`);
      if (!content) return null;
      const parsed = JSON.parse(content) as Partial<AttachmentRecord>;
      if (!parsed.dataUrl) return null;
      await store.saveAttachment({
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
    if (!customConfig) throw new Error('未配置 WebDAV 服务器信息，请先设置');
    if (!customConfig.url || !customConfig.username || !customConfig.password) {
      throw new Error('WebDAV 服务器地址、账号或密码不能为空');
    }
    return customConfig;
  }

  async prepareWebDavSync(
    customConfig?: WebDavConfig,
    options?: { syncAttachments?: boolean }
  ): Promise<WebDavSyncPrepareResult> {
    await this.ensureReady();
    const stored = await this.getWebDavConfig();
    const config = this.resolveValidatedConfig(customConfig || stored.config || undefined);
    const shouldBackupAttachments = options?.syncAttachments ?? stored.syncAttachments;

    const rawLocalData = await this.dataLifecycleService.exportData({ includeTombstones: true });
    const localData = sanitizeSyncPayload(rawLocalData);
    const localSerialized = serializeExportDataToShards(localData);
    const remoteManifestContent = await webdavClient.fetchFile(config, SYNC_MANIFEST_FILE);
    const now = new Date().toISOString();

    if (!remoteManifestContent) {
      await this.uploadChangedShards(config, localSerialized, now);
      const uploadedAttachments = await this.finalizeSyncState({
        config,
        transactions: localData.transactions,
        shouldBackupAttachments,
        uploadedAttachmentIds: stored.uploadedAttachmentIds,
        nowIso: now,
        baseSnapshot: { data: localData, shardHashes: localSerialized.hashes },
      });
      return {
        status: 'first_backup',
        uploadedAttachments,
        message:
          uploadedAttachments > 0
            ? `首次备份成功，已上传账本及 ${uploadedAttachments} 个凭证附件`
            : '首次备份成功，已上传账本数据到云端',
      };
    }

    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(remoteManifestContent);
    } catch {
      throw new Error('云端同步索引文件损坏，请清空云端旧文件后重新同步');
    }
    if (!isValidSyncManifest(parsedManifest)) {
      throw new Error('云端同步数据格式不兼容或已损坏，请清空云端旧文件后重新同步');
    }

    const baseRecord = await this.getBaseRecord();
    const hashesUnchanged =
      baseRecord &&
      areValuesCanonicallyEqual(parsedManifest.files, baseRecord.shardHashes) &&
      areValuesCanonicallyEqual(localSerialized.hashes, baseRecord.shardHashes);

    if (hashesUnchanged) {
      const uploadedAttachments = await this.finalizeSyncState({
        config,
        transactions: localData.transactions,
        shouldBackupAttachments,
        uploadedAttachmentIds: stored.uploadedAttachmentIds,
        nowIso: now,
      });
      const attSuffix = uploadedAttachments > 0 ? `，另备份 ${uploadedAttachments} 个凭证附件` : '';
      return { status: 'up_to_date', uploadedAttachments, message: `同步完成：数据已是最新${attSuffix}` };
    }

    const remoteData = await this.fetchRemoteExportData(config, parsedManifest, baseRecord);
    const plan = buildThreeWaySyncPlan(localData, remoteData, baseRecord?.snapshot ?? null);

    if (plan.isStrictlyEqual) {
      const uploadedAttachments = await this.finalizeSyncState({
        config,
        transactions: localData.transactions,
        shouldBackupAttachments,
        uploadedAttachmentIds: stored.uploadedAttachmentIds,
        nowIso: now,
        baseSnapshot: { data: localData, shardHashes: localSerialized.hashes },
      });
      const attSuffix = uploadedAttachments > 0 ? `，另备份 ${uploadedAttachments} 个凭证附件` : '';
      return { status: 'up_to_date', uploadedAttachments, message: `同步完成：数据已是最新${attSuffix}` };
    }

    if (!plan.requiresReview) {
      const committed = await this.commitWebDavSync(plan, {}, config, {
        syncAttachments: shouldBackupAttachments,
        remoteShardHashes: parsedManifest.files,
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
      remoteShardHashes: parsedManifest.files,
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
    options?: { syncAttachments?: boolean; remoteShardHashes?: Record<string, string> }
  ): Promise<WebDavSyncCommitResult> {
    await this.ensureReady();
    const stored = await this.getWebDavConfig();
    const config = this.resolveValidatedConfig(customConfig || stored.config || undefined);
    const shouldBackupAttachments = options?.syncAttachments ?? stored.syncAttachments;
    const effectiveRemoteShardHashes =
      options?.remoteShardHashes ?? this.pendingReviewPlan?.remoteShardHashes;
    const now = new Date().toISOString();

    const mergeResult = resolveSyncPlan(plan, resolutions, { retainTombstones: true, nowIso: now });
    const cleanMerged = sanitizeSyncPayload(mergeResult.merged);
    const mergedSerialized = serializeExportDataToShards(cleanMerged);

    if (mergeResult.changedLocal) {
      await this.dataLifecycleService.applySyncChanges(cleanMerged, {
        preserveSettingKeys: LOCAL_ONLY_SETTING_KEYS,
      });
      this.deps.onDataImported?.();
    }

    if (mergeResult.changedRemote) {
      await this.uploadChangedShards(config, mergedSerialized, now, effectiveRemoteShardHashes);
    }

    const uploadedAttachments = await this.finalizeSyncState({
      config,
      transactions: cleanMerged.transactions,
      shouldBackupAttachments,
      uploadedAttachmentIds: stored.uploadedAttachmentIds,
      nowIso: now,
      baseSnapshot: { data: cleanMerged, shardHashes: mergedSerialized.hashes },
    });

    const localChanges =
      mergeResult.stats.addedLocal + mergeResult.stats.updatedLocal + mergeResult.stats.deletedLocal;
    const remoteChanges =
      mergeResult.stats.addedRemote + mergeResult.stats.updatedRemote + mergeResult.stats.deletedRemote;
    const attachmentSuffix =
      uploadedAttachments > 0 ? `，另备份 ${uploadedAttachments} 个凭证附件` : '';

    const message =
      localChanges > 0 || remoteChanges > 0
        ? `同步完成：本地合并 ${localChanges} 项，云端更新 ${remoteChanges} 项${attachmentSuffix}`
        : `同步完成：数据已是最新${attachmentSuffix}`;

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
