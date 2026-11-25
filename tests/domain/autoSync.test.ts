import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SyncService,
  stripInlineVoucherPayloads,
  SYNC_BASE_SETTING_ID,
  SYNC_VAULT_FILE,
} from '../../src/domain/sync/syncService';
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

describe('WebDAV daily auto-sync scheduler', () => {
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
      service.shouldRunDailyAutoSync({ url: 'https://dav.example.com', username: '', password: '' }, true, undefined, '2026-11-18')
    ).toBe(false);
  });

  it('runs auto-sync when never synced or last sync was on a previous logical day after 06:00 AM', () => {
    expect(service.shouldRunDailyAutoSync(validConfig, true, undefined, new Date(2026, 10, 18, 8, 0, 0))).toBe(true);
    const yesterday = new Date(2026, 10, 17, 22, 0, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, yesterday, new Date(2026, 10, 18, 6, 0, 0))).toBe(true);
  });

  it('skips auto-sync late at night after midnight before 06:00 AM morning cutoff', () => {
    const lateEveningSync = new Date(2026, 10, 17, 22, 30, 0).toISOString();
    const pastMidnight = new Date(2026, 10, 18, 0, 30, 0);
    const beforeMorning = new Date(2026, 10, 18, 5, 59, 0);

    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, pastMidnight)).toBe(false);
    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, beforeMorning)).toBe(false);
  });

  it('skips auto-sync when already synced in the same logical day', () => {
    const todayMorning = new Date(2026, 10, 18, 8, 30, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, todayMorning, new Date(2026, 10, 18, 21, 0, 0))).toBe(false);
    expect(service.shouldRunDailyAutoSync(validConfig, true, todayMorning, new Date(2026, 10, 19, 1, 15, 0))).toBe(false);
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

  describe('three-way WebDAV sync preparation and review gating', () => {
    let memAdapter: MemoryAdapter;
    let settingsService: SettingsService;
    let dataLifecycleService: DataLifecycleService;
    let txRepo: TransactionRepository;
    let acctRepo: AccountRepository;
    let onDataImported: ReturnType<typeof vi.fn>;
    let syncSvc: SyncService;

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

    it('skips both putFile and import when local and remote payloads are strictly equal', async () => {
      const tx: Transaction = {
        id: 'tx_eq_1',
        type: 'expense',
        amount: 4200,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-11-25',
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      };
      const acct: Account = {
        id: 'acct_1',
        name: 'Wallet',
        type: 'savings',
        balance: 10000,
        currency: 'CNY',
        icon: 'wallet',
        sortOrder: 1,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      };

      await dataLifecycleService.restoreData({
        version: '4.0.0',
        exportedAt: '2026-11-25T09:00:00.000Z',
        transactions: [tx],
        accounts: [acct],
        categories: [],
        settings: {
          webdav_config: {
            id: 'webdav_config',
            config: validConfig,
            lastSyncAt: '2026-11-25T09:05:00.000Z',
            autoSyncDaily: true,
          },
        },
        plugins: { data: [], settings: {} },
      });

      const remoteSnapshot: ExportData = {
        version: '4.0.0',
        exportedAt: '2026-11-24T00:00:00.000Z',
        transactions: [tx],
        accounts: [acct],
        categories: [],
        settings: {},
        plugins: { data: [], settings: {} },
      };

      const fetchSpy = vi
        .spyOn(webdavClient, 'fetchFile')
        .mockResolvedValue(JSON.stringify(remoteSnapshot));
      const putSpy = vi.spyOn(webdavClient, 'putFile').mockResolvedValue(undefined);
      const replaceSpy = vi.spyOn(memAdapter, 'replaceAll');

      const result = await syncSvc.prepareWebDavSync(validConfig);

      expect(fetchSpy).toHaveBeenCalledWith(validConfig, SYNC_VAULT_FILE);
      expect(result.status).toBe('up_to_date');
      expect(putSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
      const savedBase = await settingsService.getSetting(SYNC_BASE_SETTING_ID);
      expect(savedBase).not.toBeNull();
    });

    it('pauses without writing local DB when cloud has incoming changes or conflicts', async () => {
      const localTx: Transaction = {
        id: 'tx_1',
        type: 'expense',
        amount: 4200,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-11-25',
        note: 'Local note',
        ext: { 'owned-items': { itemId: 'item_1', itemRole: 'buy', kind: 'physical' } },
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:30:00.000Z',
      };
      const baseTx: Transaction = {
        ...localTx,
        note: 'Base note',
        ext: undefined,
        updatedAt: '2026-11-25T09:00:00.000Z',
      };
      const remoteIncomingTx: Transaction = {
        id: 'tx_remote_new',
        type: 'expense',
        amount: 9900,
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-11-25',
        createdAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:00:00.000Z',
      };
      const acct: Account = {
        id: 'acct_1',
        name: 'Wallet',
        type: 'savings',
        balance: 10000,
        currency: 'CNY',
        icon: 'wallet',
        sortOrder: 1,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      };

      const baseSnapshot: ExportData = {
        version: '4.0.0',
        exportedAt: '2026-11-25T09:00:00.000Z',
        transactions: [baseTx],
        accounts: [acct],
        categories: [],
        settings: {},
        plugins: { data: [], settings: {} },
      };

      await dataLifecycleService.restoreData({
        version: '4.0.0',
        exportedAt: '2026-11-25T09:30:00.000Z',
        transactions: [localTx],
        accounts: [acct],
        categories: [],
        settings: {
          [SYNC_BASE_SETTING_ID]: {
            id: SYNC_BASE_SETTING_ID,
            snapshot: baseSnapshot,
          },
        },
        plugins: { data: [], settings: {} },
      });

      const remoteSnapshot: ExportData = {
        ...baseSnapshot,
        transactions: [baseTx, remoteIncomingTx],
      };

      vi.spyOn(webdavClient, 'fetchFile').mockResolvedValue(JSON.stringify(remoteSnapshot));
      const putSpy = vi.spyOn(webdavClient, 'putFile').mockResolvedValue(undefined);
      const replaceSpy = vi.spyOn(memAdapter, 'replaceAll');

      const prep = await syncSvc.prepareWebDavSync(validConfig);

      expect(prep.status).toBe('needs_review');
      expect(prep.plan?.incomingItems.some((i) => i.id === 'tx_remote_new')).toBe(true);
      expect(prep.plan?.pushItems.some((i) => i.id === 'tx_1')).toBe(true);
      expect(putSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();

      await syncSvc.commitWebDavSync(prep.plan!, { 'transactions:tx_remote_new': 'remote' }, validConfig);
      expect(replaceSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(onDataImported).toHaveBeenCalledTimes(1);
      const currentTxs = await txRepo.findAll();
      expect(currentTxs).toHaveLength(2);
      const updatedAcct = await acctRepo.findById('acct_1');
      expect(updatedAcct?.balance).toBe(100);
    });
  });
});
