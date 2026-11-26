import { describe, it, expect } from 'vitest';
import {
  isCanonicalAccountId,
  isCanonicalCategoryId,
  isCanonicalTransactionId,
  normalizeDataIds,
} from '../../src/domain/data/idNormalizer';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { CoreContext } from '../../src/core';
import { STORES } from '../../src/core/db/schema';
import type { ExportData } from '../../src/types/adapter';

describe('Canonical ID Normalizer', () => {
  it('validates canonical prefixes and rejects legacy/import prefixes', () => {
    expect(isCanonicalAccountId('acct_default')).toBe(true);
    expect(isCanonicalAccountId('id_123')).toBe(false);
    expect(isCanonicalCategoryId('cat_food')).toBe(true);
    expect(isCanonicalCategoryId('food')).toBe(false);

    expect(isCanonicalTransactionId('tx_123')).toBe(true);
    expect(isCanonicalTransactionId('wx_4200001')).toBe(true);
    expect(isCanonicalTransactionId('ali_20261111_abc')).toBe(true);
    expect(isCanonicalTransactionId('wealth_ali_2026-11_a1b2c3d4')).toBe(true);
    expect(isCanonicalTransactionId('csv_elephant_0123456789abcdef')).toBe(true);

    expect(isCanonicalTransactionId('tx_imp_wechat_123')).toBe(false);
    expect(isCanonicalTransactionId('id_1732000000')).toBe(false);
    expect(isCanonicalTransactionId('')).toBe(false);
  });

  it('converts missing/non-canonical IDs and tx_imp_* + importMeta directly to canonical IDs and cascades FKs', () => {
    const raw: ExportData = {
      version: '4.0.0',
      exportedAt: '2026-11-26T00:00:00.000Z',
      accounts: [
        {
          id: 'old_bank',
          name: '招商银行',
          type: 'savings',
          balance: 10000,
          currency: 'CNY',
          icon: 'landmark',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'old_credit',
          name: '招商信用卡',
          type: 'credit',
          balance: -2000,
          repaymentAccountId: 'old_bank',
          currency: 'CNY',
          icon: 'credit-card',
          sortOrder: 2,
          createdAt: '',
          updatedAt: '',
        },
      ],
      categories: [
        {
          id: 'custom_parent',
          name: '居家',
          type: 'expense',
          icon: 'house',
          color: 'var(--cat-home)',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'custom_child',
          name: '水电煤',
          type: 'expense',
          parentId: 'custom_parent',
          icon: 'house',
          color: 'var(--cat-home)',
          sortOrder: 2,
          createdAt: '',
          updatedAt: '',
        },
      ],
      transactions: [
        {
          id: 'id_1732_aa_host',
          type: 'expense',
          amount: 10000,
          accountId: 'old_credit',
          categoryId: 'custom_child',
          date: '2026-11-20',
          note: '聚餐垫付',
          createdAt: '2026-11-20T12:00:00.000Z',
          updatedAt: '2026-11-20T12:00:00.000Z',
        },
        {
          id: 'id_1732_aa_offset',
          type: 'income',
          amount: 5000,
          accountId: 'old_bank',
          categoryId: 'cat_other_in',
          offsetTransactionId: 'id_1732_aa_host',
          date: '2026-11-21',
          createdAt: '2026-11-21T09:00:00.000Z',
          updatedAt: '2026-11-21T09:00:00.000Z',
        },
        {
          id: 'tx_imp_alipay_ali_001',
          type: 'expense',
          amount: 2500,
          accountId: 'old_credit',
          categoryId: 'custom_child',
          date: '2026-11-22',
          ext: {
            importMeta: { source: 'alipay', orderId: 'ali_001' },
            'owned-items': { itemId: 'item_1', itemRole: 'buy', kind: 'physical' },
          },
          createdAt: '2026-11-22T10:00:00.000Z',
          updatedAt: '2026-11-22T10:00:00.000Z',
        },
        {
          id: 'tx_imp_alipay_wealth_2026-11_aabbccdd',
          type: 'income',
          amount: 199,
          accountId: 'old_bank',
          categoryId: 'cat_invest',
          date: '2026-11-25',
          ext: {
            importMeta: {
              source: 'alipay',
              orderId: 'wealth:2026-11:余额宝',
              kind: 'wealth_monthly',
              month: '2026-11',
              itemCount: 3,
            },
          },
          createdAt: '2026-11-25T06:00:00.000Z',
          updatedAt: '2026-11-25T06:00:00.000Z',
        },
      ],
      settings: {},
      plugins: {
        data: [{ name: 'Desk Lamp' } as unknown as { id: string }],
        settings: {},
      },
    };

    const firstPass = normalizeDataIds(raw);
    expect(firstPass.changed).toBe(true);

    const bank = firstPass.data.accounts[0];
    const credit = firstPass.data.accounts[1];
    expect(bank.id).toMatch(/^acct_[0-9a-f]{16}$/);
    expect(credit.id).toMatch(/^acct_[0-9a-f]{16}$/);
    expect(credit.repaymentAccountId).toBe(bank.id);

    const parentCat = firstPass.data.categories[0];
    const childCat = firstPass.data.categories[1];
    expect(parentCat.id).toMatch(/^cat_[0-9a-f]{16}$/);
    expect(childCat.id).toMatch(/^cat_[0-9a-f]{16}$/);
    expect(childCat.parentId).toBe(parentCat.id);

    const [aaHost, aaOffset, aliTx, wealthTx] = firstPass.data.transactions;
    expect(aaHost.id).toMatch(/^tx_[0-9a-f]{16}$/);
    expect(aaHost.id).not.toContain('legacy_');
    expect(aaHost.accountId).toBe(credit.id);
    expect(aaHost.categoryId).toBe(childCat.id);

    expect(aaOffset.id).toMatch(/^tx_[0-9a-f]{16}$/);
    expect(aaOffset.accountId).toBe(bank.id);
    expect(aaOffset.offsetTransactionId).toBe(aaHost.id);

    expect(aliTx.id).toBe('ali_ali_001');
    expect(aliTx.ext).toEqual({
      'owned-items': { itemId: 'item_1', itemRole: 'buy', kind: 'physical' },
    });

    expect(wealthTx.id).toMatch(/^wealth_ali_2026-11_[0-9a-f]{8}$/);
    expect(wealthTx.ext).toBeUndefined();

    expect(firstPass.data.plugins?.data[0].id).toMatch(/^pd_[0-9a-f]{16}$/);

    // Deterministic across independent runs and idempotent on second pass
    const repeatPass = normalizeDataIds(raw);
    expect(repeatPass.data).toEqual(firstPass.data);

    const idempotentPass = normalizeDataIds(firstPass.data);
    expect(idempotentPass.changed).toBe(false);
    expect(idempotentPass.data).toBe(firstPass.data);
  });

  it('auto-normalizes non-canonical DB records during CoreContext.init() and clears stale sync base', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    await adapter.put(STORES.ACCOUNTS, {
      id: 'id_old_acct',
      name: '零花钱',
      type: 'savings',
      balance: 5000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    });
    await adapter.put(STORES.TRANSACTIONS, {
      id: 'id_old_tx',
      type: 'expense',
      amount: 1200,
      accountId: 'id_old_acct',
      categoryId: 'cat_food',
      date: '2026-11-20',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    });
    await adapter.put(STORES.SETTINGS, {
      id: 'webdav_sync_base',
      createdAt: '',
      updatedAt: '',
      snapshot: {},
    });

    const ctx = new CoreContext(adapter);
    await ctx.init();

    const accts = await ctx.acctRepo.findAll();
    const migratedAcct = accts.find((a) => a.name === '零花钱');
    expect(migratedAcct).toBeDefined();
    expect(migratedAcct!.id).toMatch(/^acct_[0-9a-f]{16}$/);
    expect(await ctx.acctRepo.getRawById('id_old_acct')).toBeNull();

    const txs = await ctx.txRepo.findAll();
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toMatch(/^tx_[0-9a-f]{16}$/);
    expect(txs[0].accountId).toBe(migratedAcct!.id);
    expect(await ctx.txRepo.getRawById('id_old_tx')).toBeNull();

    const staleBase = await ctx.settingsRepo.getSetting('webdav_sync_base');
    expect(staleBase).toBeNull();
  });
});
