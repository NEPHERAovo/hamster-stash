import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SyncService,
  stripInlineVoucherPayloads,
  SYNC_BASE_SETTING_ID,
  SYNC_MANIFEST_FILE,
  SYNC_MANIFEST_VERSION,
  SYNC_META_FILE,
  SYNC_SETTINGS_FILE,
} from '../../src/domain/sync/syncService';
import { serializeExportDataToShards } from '../../src/domain/sync/syncShards';
import { webdavClient, type WebDavConfig } from '../../src/domain/sync/webdavClient';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { SettingsRepository } from '../../src/core/repositories/SettingsRepository';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { SettingsService } from '../../src/domain/settings/settingsService';
import { DataLifecycleService } from '../../src/domain/data/dataLifecycleService';
import { AttachmentStore } from '../../src/core/attachments/attachmentStore';
import type { ExportData } from '../../src/types/adapter';
import type { Transaction } from '../../src/types/transaction';
import type { Account } from '../../src/types/account';

function createRemoteWebDavMock(backingMap?: Map<string, string>) {
  const remoteFiles = backingMap ?? new Map<string, string>();
  const fetchSpy = vi
    .spyOn(webdavClient, 'fetchFile')
    .mockImplementation(async (_cfg, path) => remoteFiles.get(path) ?? null);
  const putSpy = vi
    .spyOn(webdavClient, 'putFile')
    .mockImplementation(async (_cfg, path, content) => {
      remoteFiles.set(path, content);
    });
  return { remoteFiles, fetchSpy, putSpy };
}

function seedRemoteFromExport(remoteFiles: Map<string, string>, data: ExportData): void {
  const serialized = serializeExportDataToShards(data);
  for (const [path, content] of serialized.shards.entries()) {
    remoteFiles.set(path, content);
  }
  remoteFiles.set(
    SYNC_MANIFEST_FILE,
    JSON.stringify({
      version: SYNC_MANIFEST_VERSION,
      updatedAt: '2026-11-25T09:00:00.000Z',
      files: serialized.hashes,
    })
  );
}

describe('WebDAV daily auto-sync & sharded sync', () => {
  const service = new SyncService();
  const validConfig: WebDavConfig = {
    url: 'https://dav.example.com/dav/',
    username: 'demo',
    password: 'secret',
  };

  it('skips auto-sync when disabled or credentials are incomplete', () => {
    expect(service.shouldRunDailyAutoSync(validConfig, false, undefined, '2026-11-18')).toBe(false);
    expect(service.shouldRunDailyAutoSync(null, true, undefined, '2026-11-18')).toBe(false);
    expect(
      service.shouldRunDailyAutoSync(
        { url: 'https://dav.example.com', username: '', password: '' },
        true,
        undefined,
        '2026-11-18'
      )
    ).toBe(false);
  });

  it('runs auto-sync when never synced or last sync was on a previous logical day after 06:00 AM', () => {
    expect(
      service.shouldRunDailyAutoSync(validConfig, true, undefined, new Date(2026, 10, 18, 8, 0, 0))
    ).toBe(true);
    const yesterday = new Date(2026, 10, 17, 22, 0, 0).toISOString();
    expect(
      service.shouldRunDailyAutoSync(validConfig, true, yesterday, new Date(2026, 10, 18, 6, 0, 0))
    ).toBe(true);
  });

  it('skips auto-sync late at night after midnight before 06:00 AM morning cutoff', () => {
    const lateEveningSync = new Date(2026, 10, 17, 22, 30, 0).toISOString();
    const pastMidnight = new Date(2026, 10, 18, 0, 30, 0);
    const beforeMorning = new Date(2026, 10, 18, 5, 59, 0);

    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, pastMidnight)).toBe(
      false
    );
    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, beforeMorning)).toBe(
      false
    );
  });

  it('skips auto-sync when already synced in the same logical day', () => {
    const todayMorning = new Date(2026, 10, 18, 8, 30, 0).toISOString();
    expect(
      service.shouldRunDailyAutoSync(
        validConfig,
        true,
        todayMorning,
        new Date(2026, 10, 18, 21, 0, 0)
      )
    ).toBe(false);
    expect(
      service.shouldRunDailyAutoSync(
        validConfig,
        true,
        todayMorning,
        new Date(2026, 10, 19, 1, 15, 0)
      )
    ).toBe(false);
  });

  it('strips inline base64 voucher payloads while retaining lightweight attachment references', () => {
    const payload: ExportData = {
      version: '1.0.0',
      exportedAt: '2026-11-18T12:00:00.000Z',
      transactions: [
        {
          id: 'tx_att_1',
          type: 'expense',
          amount: 2500,
          categoryId: 'cat_food',
          accountId: 'acct_1',
          date: '2026-11-18',
          createdAt: '2026-11-18T12:00:00.000Z',
          updatedAt: '2026-11-18T12:00:00.000Z',
          voucher: {
            attachmentId: 'att_abcdef0123456789',
            name: 'invoice.jpg',
            size: '120 KB',
            mimeType: 'image/jpeg',
            fileUrl: 'data:image/jpeg;base64,HUGE_PAYLOAD',
          },
        },
      ],
      accounts: [],
      categories: [],
    };

    const stripped = stripInlineVoucherPayloads(payload);
    expect(stripped.transactions[0].voucher?.attachmentId).toBe('att_abcdef0123456789');
    expect(stripped.transactions[0].voucher?.name).toBe('invoice.jpg');
    expect(stripped.transactions[0].voucher?.fileUrl).toBeUndefined();
    expect(JSON.stringify(stripped)).not.toContain('HUGE_PAYLOAD');
  });

  describe('partitioned three-way WebDAV sync & shard caching', () => {
    let memAdapter: MemoryAdapter;
    let settingsService: SettingsService;
    let dataLifecycleService: DataLifecycleService;
    let txRepo: TransactionRepository;
    let acctRepo: AccountRepository;
    let onDataImported: ReturnType<typeof vi.fn>;
    let syncSvc: SyncService;

    const sampleAcct: Account = {
      id: 'acct_1',
      name: 'Wallet',
      type: 'savings',
      balance: 10000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    beforeEach(async () => {
      vi.restoreAllMocks();
      memAdapter = new MemoryAdapter();
      await memAdapter.initialize();
      const settingsRepo = new SettingsRepository(memAdapter);
      txRepo = new TransactionRepository(memAdapter);
      acctRepo = new AccountRepository(memAdapter);
      settingsService = new SettingsService(settingsRepo);
      dataLifecycleService = new DataLifecycleService(memAdapter);
      onDataImported = vi.fn();
      syncSvc = new SyncService({
        settingsService,
        dataLifecycleService,
        attachmentStore: new AttachmentStore(memAdapter),
        onDataImported,
      });
    });

    it('uploads settings, meta, yearly transaction shards, and writes manifest.json last on first backup', async () => {
      const tx25: Transaction = {
        id: 'tx_25',
        type: 'expense',
        amount: 1200,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2025-06-10',
        createdAt: '2025-06-10T10:00:00.000Z',
        updatedAt: '2025-06-10T10:00:00.000Z',
      };
      const tx26: Transaction = {
        id: 'tx_26',
        type: 'expense',
        amount: 4200,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-11-25',
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      };

      await dataLifecycleService.restoreData({
        version: '4.0.0',
        exportedAt: '2026-11-25T09:00:00.000Z',
        transactions: [tx25, tx26],
        accounts: [sampleAcct],
        categories: [],
        settings: {
          webdav_config: {
            id: 'webdav_config',
            config: validConfig,
            autoSyncDaily: true,
          },
          app_preferences: { id: 'app_preferences', currencySymbol: '¥' },
        },
        plugins: { data: [], settings: {} },
      });

      const { remoteFiles, fetchSpy, putSpy } = createRemoteWebDavMock();
      const result = await syncSvc.prepareWebDavSync(validConfig);

      expect(result.status).toBe('first_backup');
      const uploadedPaths = putSpy.mock.calls.map((c) => c[1]);
      expect(uploadedPaths[uploadedPaths.length - 1]).toBe(SYNC_MANIFEST_FILE);
      expect(uploadedPaths).toContain(SYNC_SETTINGS_FILE);
      expect(uploadedPaths).toContain(SYNC_META_FILE);
      expect(uploadedPaths).toContain('transactions/2025.json');
      expect(uploadedPaths).toContain('transactions/2026.json');
      expect(remoteFiles.get(SYNC_SETTINGS_FILE)).not.toContain('webdav_config');

      // Immediate second sync hits manifest fast-path with only 1 GET and 0 PUTs
      fetchSpy.mockClear();
      putSpy.mockClear();
      const secondResult = await syncSvc.prepareWebDavSync(validConfig);
      expect(secondResult.status).toBe('up_to_date');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(validConfig, SYNC_MANIFEST_FILE);
      expect(putSpy).not.toHaveBeenCalled();
    });

    it('fetches and uploads only changed year shards while preserving unchanged years and webdav_config', async () => {
      const tx25: Transaction = {
        id: 'tx_25',
        type: 'expense',
        amount: 1000,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2025-05-01',
        createdAt: '2025-05-01T10:00:00.000Z',
        updatedAt: '2025-05-01T10:00:00.000Z',
      };
      const baseTx26: Transaction = {
        id: 'tx_26',
        type: 'expense',
        amount: 4200,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-11-25',
        note: 'Base note',
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      };
      const localTx26: Transaction = {
        ...baseTx26,
        note: 'Local note',
        ext: { 'owned-items': { itemId: 'item_1', itemRole: 'buy', kind: 'physical' } },
        updatedAt: '2026-11-25T09:30:00.000Z',
      };
      const remoteIncomingTx26: Transaction = {
        id: 'tx_26_remote',
        type: 'expense',
        amount: 9900,
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-11-25',
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:00:00.000Z',
      };

      const baseSnapshot: ExportData = {
        version: '4.0.0',
        exportedAt: '2026-11-25T09:00:00.000Z',
        transactions: [tx25, baseTx26],
        accounts: [sampleAcct],
        categories: [],
        settings: {},
        plugins: { data: [], settings: {} },
      };
      const baseSerialized = serializeExportDataToShards(baseSnapshot);

      await dataLifecycleService.restoreData({
        version: '4.0.0',
        exportedAt: '2026-11-25T09:30:00.000Z',
        transactions: [tx25, localTx26],
        accounts: [sampleAcct],
        categories: [],
        settings: {
          webdav_config: {
            id: 'webdav_config',
            config: validConfig,
            autoSyncDaily: true,
          },
          [SYNC_BASE_SETTING_ID]: {
            id: SYNC_BASE_SETTING_ID,
            version: SYNC_MANIFEST_VERSION,
            shardHashes: baseSerialized.hashes,
            snapshot: baseSnapshot,
          },
        },
        plugins: { data: [], settings: {} },
      });

      const remoteSnapshot: ExportData = {
        ...baseSnapshot,
        transactions: [tx25, baseTx26, remoteIncomingTx26],
      };
      const seededMap = new Map<string, string>();
      seedRemoteFromExport(seededMap, remoteSnapshot);
      const { fetchSpy, putSpy } = createRemoteWebDavMock(seededMap);
      const replaceSpy = vi.spyOn(memAdapter, 'replaceAll');

      const prep = await syncSvc.prepareWebDavSync(validConfig);
      expect(prep.status).toBe('needs_review');
      expect(prep.plan?.incomingItems.some((i) => i.id === 'tx_26_remote')).toBe(true);
      expect(prep.plan?.pushItems.some((i) => i.id === 'tx_26')).toBe(true);

      // Only manifest.json + transactions/2026.json were fetched; 2025/settings/meta reused from base cache
      const fetchedPaths = fetchSpy.mock.calls.map((c) => c[1]);
      expect(fetchedPaths).toEqual([SYNC_MANIFEST_FILE, 'transactions/2026.json']);
      expect(putSpy).not.toHaveBeenCalled();

      await syncSvc.commitWebDavSync(
        prep.plan!,
        { 'transactions:tx_26_remote': 'remote' },
        validConfig
      );

      expect(replaceSpy).not.toHaveBeenCalled();
      expect(onDataImported).toHaveBeenCalledTimes(1);

      const uploadedPaths = putSpy.mock.calls.map((c) => c[1]);
      expect(uploadedPaths).toEqual([
        SYNC_META_FILE,
        'transactions/2026.json',
        SYNC_MANIFEST_FILE,
      ]);

      const currentTxs = await txRepo.findAll();
      expect(currentTxs).toHaveLength(3);
      const updatedAcct = await acctRepo.findById('acct_1');
      expect(updatedAcct?.balance).toBe(100);
      const preservedConfig = await settingsService.getSetting('webdav_config');
      expect(preservedConfig).not.toBeNull();
    });

    it('drops stale v1 webdav_sync_base cleanly and updates both old and new shards on cross-year move', async () => {
      const localTx: Transaction = {
        id: 'tx_moved',
        type: 'expense',
        amount: 3000,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-01-02',
        createdAt: '2025-12-31T23:55:00.000Z',
        updatedAt: '2026-01-02T08:00:00.000Z',
      };
      const baseTx: Transaction = {
        ...localTx,
        date: '2025-12-31',
        updatedAt: '2025-12-31T23:55:00.000Z',
      };

      const v2BaseSnapshot: ExportData = {
        version: '4.0.0',
        exportedAt: '2025-12-31T23:55:00.000Z',
        transactions: [baseTx],
        accounts: [sampleAcct],
        categories: [],
        settings: {},
        plugins: { data: [], settings: {} },
      };
      const v2BaseSerialized = serializeExportDataToShards(v2BaseSnapshot);

      await dataLifecycleService.restoreData({
        version: '4.0.0',
        exportedAt: '2026-01-02T08:00:00.000Z',
        transactions: [localTx],
        accounts: [sampleAcct],
        categories: [],
        settings: {
          [SYNC_BASE_SETTING_ID]: {
            id: SYNC_BASE_SETTING_ID,
            version: SYNC_MANIFEST_VERSION,
            shardHashes: v2BaseSerialized.hashes,
            snapshot: v2BaseSnapshot,
          },
        },
        plugins: { data: [], settings: {} },
      });

      const remoteMap = new Map<string, string>();
      seedRemoteFromExport(remoteMap, v2BaseSnapshot);
      const { putSpy } = createRemoteWebDavMock(remoteMap);

      const prep = await syncSvc.prepareWebDavSync(validConfig);
      expect(prep.status).toBe('synced');
      expect(putSpy.mock.calls.map((c) => c[1])).toEqual([
        'transactions/2026.json',
        SYNC_MANIFEST_FILE,
      ]);
      const finalManifest = JSON.parse(remoteMap.get(SYNC_MANIFEST_FILE)!);
      expect(finalManifest.files['transactions/2025.json']).toBeUndefined();
      expect(finalManifest.files['transactions/2026.json']).toBeDefined();

      // Verify old v1 base record without version: 2 is ignored cleanly
      await settingsService.saveSetting(SYNC_BASE_SETTING_ID, { snapshot: v2BaseSnapshot });
      remoteMap.clear();
      putSpy.mockClear();
      const firstAfterReset = await syncSvc.prepareWebDavSync(validConfig);
      expect(firstAfterReset.status).toBe('first_backup');
      expect(putSpy).toHaveBeenCalled();
    });
  });
});
