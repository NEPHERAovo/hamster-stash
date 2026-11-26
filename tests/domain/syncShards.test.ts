import { describe, it, expect } from 'vitest';
import {
  assembleExportDataFromShards,
  extractCachedShardsFromExport,
  getTransactionShardPath,
  isValidSyncManifest,
  serializeExportDataToShards,
  SYNC_MANIFEST_VERSION,
  SYNC_META_FILE,
  SYNC_SETTINGS_FILE,
  type MetaShard,
  type SettingsShard,
} from '../../src/domain/sync/syncShards';
import type { ExportData } from '../../src/types/adapter';
import type { Transaction } from '../../src/types/transaction';

describe('SyncShards Serializer & Assembler', () => {
  it('groups transactions by year with fallback to transactions/unknown.json', () => {
    expect(getTransactionShardPath({ date: '2026-11-26' })).toBe('transactions/2026.json');
    expect(getTransactionShardPath({ date: '2024-01-01' })).toBe('transactions/2024.json');
    expect(getTransactionShardPath({ date: '' })).toBe('transactions/unknown.json');
    expect(getTransactionShardPath({ date: 'bad-date' })).toBe('transactions/unknown.json');
  });

  it('produces identical shard hashes regardless of input entity ordering and omits empty years', () => {
    const tx25a: Transaction = {
      id: 'tx_25_a',
      type: 'expense',
      amount: 1000,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2025-05-01',
      createdAt: '2025-05-01T10:00:00.000Z',
      updatedAt: '2025-05-01T10:00:00.000Z',
    };
    const tx26a: Transaction = {
      id: 'tx_26_a',
      type: 'expense',
      amount: 2000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-01-05',
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-05T10:00:00.000Z',
    };
    const tx26b: Transaction = {
      id: 'tx_26_b',
      type: 'income',
      amount: 5000,
      accountId: 'acct_1',
      categoryId: 'cat_salary',
      date: '2026-02-01',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    };

    const dataA: ExportData = {
      version: '4.0.0',
      exportedAt: '2026-11-26T00:00:00.000Z',
      transactions: [tx26b, tx25a, tx26a],
      accounts: [],
      categories: [],
      settings: { b: 2, a: 1 },
      plugins: { data: [], settings: {} },
    };
    const dataB: ExportData = {
      version: '4.0.0',
      exportedAt: '2026-12-01T00:00:00.000Z',
      transactions: [tx25a, tx26a, tx26b],
      accounts: [],
      categories: [],
      settings: { a: 1, b: 2 },
      plugins: { data: [], settings: {} },
    };

    const serA = serializeExportDataToShards(dataA);
    const serB = serializeExportDataToShards(dataB);

    expect(serA.hashes).toEqual(serB.hashes);
    expect(Object.keys(serA.hashes).sort()).toEqual([
      SYNC_META_FILE,
      SYNC_SETTINGS_FILE,
      'transactions/2025.json',
      'transactions/2026.json',
    ]);
    expect(serA.hashes['transactions/2024.json']).toBeUndefined();

    const cached = extractCachedShardsFromExport(dataA);
    const assembled = assembleExportDataFromShards(
      cached.get(SYNC_SETTINGS_FILE) as SettingsShard,
      cached.get(SYNC_META_FILE) as MetaShard,
      [
        cached.get('transactions/2025.json') as Transaction[],
        cached.get('transactions/2026.json') as Transaction[],
      ]
    );
    expect(assembled.transactions).toHaveLength(3);
    expect(assembled.settings).toEqual({ b: 2, a: 1 });
  });

  it('validates v2 manifest schema strictly', () => {
    expect(
      isValidSyncManifest({
        version: SYNC_MANIFEST_VERSION,
        updatedAt: '2026-11-26T00:00:00.000Z',
        files: { [SYNC_SETTINGS_FILE]: 'abc123' },
      })
    ).toBe(true);

    expect(isValidSyncManifest({ version: 1, files: {} })).toBe(false);
    expect(isValidSyncManifest({ version: 2, files: { a: 123 } })).toBe(false);
    expect(isValidSyncManifest(null)).toBe(false);
  });
});
