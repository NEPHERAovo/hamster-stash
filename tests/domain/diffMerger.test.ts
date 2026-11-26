import { describe, it, expect } from 'vitest';
import {
  mergeSyncPayloads,
  buildThreeWaySyncPlan,
  resolveSyncPlan,
  areValuesCanonicallyEqual,
} from '../../src/domain/sync/diffMerger';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

describe('diffMerger', () => {
  const createBaseExport = (): ExportData => ({
    version: '4.0.0',
    exportedAt: '2026-11-18T10:00:00.000Z',
    transactions: [],
    accounts: [],
    categories: [],
    settings: {},
    plugins: {
      data: [],
      settings: {},
    },
  });

  it('merges new local items to remote payload', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const tx: Transaction = {
      id: 'tx_1',
      accountId: 'acct_1',
      categoryId: 'cat_1',
      type: 'expense',
      amount: 1500,
      timestamp: '2026-11-18T09:00:00.000Z',
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };
    local.transactions.push(tx);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.transactions).toHaveLength(1);
    expect(result.merged.transactions[0].id).toBe('tx_1');
    expect(result.stats.addedRemote).toBe(1);
    expect(result.changedRemote).toBe(true);
    expect(result.changedLocal).toBe(false);
  });

  it('merges new remote items into local payload', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const acct: Account = {
      id: 'acct_remote',
      name: 'Cloud Vault',
      type: 'savings',
      balance: 100000,
      sortOrder: 1,
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };
    remote.accounts.push(acct);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.accounts).toHaveLength(1);
    expect(result.merged.accounts[0].id).toBe('acct_remote');
    expect(result.stats.addedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
    expect(result.changedRemote).toBe(false);
  });

  it('resolves conflicts using Last-Write-Wins based on updatedAt', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const catLocal: Category = {
      id: 'cat_food',
      name: 'Food & Dining (Local)',
      type: 'expense',
      icon: 'utensils',
      sortOrder: 1,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };

    const catRemote: Category = {
      id: 'cat_food',
      name: 'Food & Dining (Remote Updated)',
      type: 'expense',
      icon: 'utensils',
      sortOrder: 1,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T09:30:00.000Z',
    };

    local.categories.push(catLocal);
    remote.categories.push(catRemote);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.categories).toHaveLength(1);
    expect(result.merged.categories[0].name).toBe('Food & Dining (Remote Updated)');
    expect(result.stats.updatedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
  });

  it('propagates tombstone deletion from remote to local', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const txLocal: Transaction = {
      id: 'tx_tombstone',
      accountId: 'acct_1',
      categoryId: 'cat_1',
      type: 'expense',
      amount: 2000,
      timestamp: '2026-11-18T08:00:00.000Z',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    };

    const txRemoteDeleted: Transaction = {
      ...txLocal,
      updatedAt: '2026-11-18T09:00:00.000Z',
      deletedAt: '2026-11-18T09:00:00.000Z',
    };

    local.transactions.push(txLocal);
    remote.transactions.push(txRemoteDeleted);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.transactions).toHaveLength(0);
    expect(result.stats.deletedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
  });

  it('merges settings and plugin data correctly', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    local.settings = {
      app_theme: { themeId: 'theme-sage', uiStyle: 'paper' },
    };
    remote.settings = {
      webdav_config: { url: 'https://dav.example.com', username: 'user1' },
    };

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.settings).toBeDefined();
    expect(result.merged.settings?.app_theme).toBeDefined();
    expect(result.merged.settings?.webdav_config).toBeDefined();
  });

  it('treats objects with reordered keys, undefined fields, and empty ext as canonically equal', () => {
    const a: Transaction = {
      id: 'tx_canon',
      type: 'expense',
      amount: 1800,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
      note: 'Coffee',
      ext: {},
      createdAt: '2026-11-25T08:00:00.000Z',
      updatedAt: '2026-11-25T08:00:00.000Z',
    };
    const b: Transaction = {
      updatedAt: '2026-11-25T08:00:00.000Z',
      createdAt: '2026-11-25T08:00:00.000Z',
      date: '2026-11-25',
      categoryId: 'cat_food',
      accountId: 'acct_1',
      amount: 1800,
      type: 'expense',
      id: 'tx_canon',
      note: 'Coffee',
      tags: undefined,
    };

    expect(areValuesCanonicallyEqual(a, b)).toBe(true);

    const local = createBaseExport();
    const remote = createBaseExport();
    local.transactions.push(a);
    remote.transactions.push(b);

    const plan = buildThreeWaySyncPlan(local, remote, local);
    expect(plan.isStrictlyEqual).toBe(true);
    expect(plan.requiresReview).toBe(false);
    expect(plan.pushItems).toHaveLength(0);
    expect(plan.incomingItems).toHaveLength(0);
    expect(plan.conflictItems).toHaveLength(0);
  });

  it('classifies local-only changes as fast-forward push without review when base matches remote', () => {
    const baseTx: Transaction = {
      id: 'tx_1',
      type: 'expense',
      amount: 19900,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'Keyboard',
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
    };
    const linkedLocalTx: Transaction = {
      ...baseTx,
      ext: { 'owned-items': { itemId: 'item_kbd', itemRole: 'buy', kind: 'physical' } },
      updatedAt: '2026-11-25T09:00:00.000Z',
    };

    const base = createBaseExport();
    base.transactions.push(baseTx);
    const remote = createBaseExport();
    remote.transactions.push(baseTx);
    const local = createBaseExport();
    local.transactions.push(linkedLocalTx);

    const plan = buildThreeWaySyncPlan(local, remote, base);
    expect(plan.isStrictlyEqual).toBe(false);
    expect(plan.requiresReview).toBe(false);
    expect(plan.pushItems).toHaveLength(1);
    expect(plan.pushItems[0].key).toBe('transactions:tx_1');

    const resolved = resolveSyncPlan(plan, {});
    expect(resolved.changedLocal).toBe(false);
    expect(resolved.changedRemote).toBe(true);
    expect(resolved.merged.transactions[0].ext).toEqual(linkedLocalTx.ext);
  });

  it('requires user review for incoming cloud additions and adjusts local account balance only once', () => {
    const baseAcct: Account = {
      id: 'acct_1',
      name: 'Cash',
      type: 'savings',
      balance: 10000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    };
    const remoteTx: Transaction = {
      id: 'tx_cloud_1',
      type: 'expense',
      amount: 2500,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    };

    const base = createBaseExport();
    base.accounts.push(baseAcct);
    const local = createBaseExport();
    local.accounts.push(baseAcct);
    const remote = createBaseExport();
    remote.accounts.push(baseAcct);
    remote.transactions.push(remoteTx);

    const plan = buildThreeWaySyncPlan(local, remote, base);
    expect(plan.requiresReview).toBe(true);
    expect(plan.incomingItems).toHaveLength(1);
    expect(plan.incomingItems[0].kind).toBe('add');

    const accepted = resolveSyncPlan(plan, { 'transactions:tx_cloud_1': 'remote' });
    expect(accepted.changedLocal).toBe(true);
    expect(accepted.merged.transactions).toHaveLength(1);
    expect(accepted.merged.accounts[0].balance).toBe(7500);
  });

  it('detects cross-id duplicate linked-vs-unlinked twins and retains tombstone on local preference', () => {
    const linkedLocal: Transaction = {
      id: 'tx_linked',
      type: 'expense',
      amount: 50000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'Headphones',
      ext: { 'owned-items': { itemId: 'item_hp', itemRole: 'buy', kind: 'physical' } },
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-25T08:00:00.000Z',
    };
    const unlinkedRemoteTwin: Transaction = {
      id: 'tx_old_twin',
      type: 'expense',
      amount: 50000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'Headphones',
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-24T12:00:00.000Z',
    };

    const local = createBaseExport();
    local.transactions.push(linkedLocal);
    const remote = createBaseExport();
    remote.transactions.push(unlinkedRemoteTwin);

    const plan = buildThreeWaySyncPlan(local, remote, null);
    expect(plan.requiresReview).toBe(true);
    expect(plan.conflictItems.some((c) => c.id === 'tx_old_twin' && c.reason === 'cross_id_duplicate')).toBe(true);

    const resolved = resolveSyncPlan(plan, { 'transactions:tx_old_twin': 'local' }, { retainTombstones: true });
    const twinInMerged = resolved.merged.transactions.find((t) => t.id === 'tx_old_twin') as (Transaction & StoredEntity) | undefined;
    expect(twinInMerged?.deletedAt).toBeTruthy();
    expect(resolved.merged.transactions.filter((t) => !(t as StoredEntity).deletedAt)).toHaveLength(1);
  });

  it('never generates account conflicts when balances diverge due to transactions and reconciles balance from bills', () => {
    const baseAcct: Account = {
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
    const localTx: Transaction = {
      id: 'tx_loc_spend',
      type: 'expense',
      amount: 1500,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
      createdAt: '2026-11-25T09:00:00.000Z',
      updatedAt: '2026-11-25T09:00:00.000Z',
    };
    const remoteTx: Transaction = {
      id: 'tx_rem_spend',
      type: 'expense',
      amount: 2500,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-25',
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    };

    const base = createBaseExport();
    base.accounts.push(baseAcct);

    const local = createBaseExport();
    local.accounts.push({
      ...baseAcct,
      balance: 8500,
      updatedAt: '2026-11-25T09:00:00.000Z',
    });
    local.transactions.push(localTx);

    const remote = createBaseExport();
    remote.accounts.push({
      ...baseAcct,
      balance: 7500,
      updatedAt: '2026-11-25T10:00:00.000Z',
    });
    remote.transactions.push(remoteTx);

    const plan = buildThreeWaySyncPlan(local, remote, base);
    expect(plan.conflictItems.every((i) => i.collection !== 'accounts')).toBe(true);
    expect(plan.incomingItems.every((i) => i.collection !== 'accounts')).toBe(true);
    expect(plan.incomingItems).toHaveLength(1);
    expect(plan.incomingItems[0].id).toBe('tx_rem_spend');

    const resolved = resolveSyncPlan(plan, { 'transactions:tx_rem_spend': 'remote' });
    expect(resolved.merged.accounts[0].balance).toBe(6000);
  });

  it('detects cross-id duplicate when cloud links Item A and local links Item B and never keeps both', () => {
    const cloudTx: Transaction = {
      id: 'tx_cloud_item_a',
      type: 'expense',
      amount: 50000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'Mechanical Keyboard',
      ext: { 'owned-items': { itemId: 'item_A', itemRole: 'buy', kind: 'physical' } },
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-25T08:00:00.000Z',
    };
    const localTx: Transaction = {
      id: 'tx_local_item_b',
      type: 'expense',
      amount: 50000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'Mechanical Keyboard',
      ext: { 'owned-items': { itemId: 'item_B', itemRole: 'buy', kind: 'physical' } },
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-25T09:00:00.000Z',
    };

    const local = createBaseExport();
    local.transactions.push(localTx);
    const remote = createBaseExport();
    remote.transactions.push(cloudTx);

    const plan = buildThreeWaySyncPlan(local, remote, null);
    expect(plan.requiresReview).toBe(true);
    expect(plan.pushItems).toHaveLength(0);
    expect(plan.conflictItems).toHaveLength(1);
    expect(plan.conflictItems[0].reason).toBe('cross_id_duplicate');
    expect((plan.conflictItems[0].localEntity as Transaction | undefined)?.id).toBe('tx_local_item_b');
    expect((plan.conflictItems[0].remoteEntity as Transaction | undefined)?.id).toBe('tx_cloud_item_a');

    const pickRemote = resolveSyncPlan(
      plan,
      { 'transactions:tx_cloud_item_a': 'remote' },
      { retainTombstones: true }
    );
    const activeRemote = pickRemote.merged.transactions.filter((t) => !(t as StoredEntity).deletedAt);
    expect(activeRemote).toHaveLength(1);
    expect(activeRemote[0].id).toBe('tx_cloud_item_a');

    const pickLocal = resolveSyncPlan(
      plan,
      { 'transactions:tx_cloud_item_a': 'local' },
      { retainTombstones: true }
    );
    const activeLocal = pickLocal.merged.transactions.filter((t) => !(t as StoredEntity).deletedAt);
    expect(activeLocal).toHaveLength(1);
    expect(activeLocal[0].id).toBe('tx_local_item_b');
  });

  it('merges same canonical imported transaction cleanly when local links owned-items or edits attributes', () => {
    const baseTx: Transaction = {
      id: 'ali_order_99',
      type: 'expense',
      amount: 129900,
      accountId: 'acct_huabei',
      categoryId: 'cat_shop',
      date: '2026-11-20',
      note: 'Mechanical Keyboard',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    };
    const editedLocal: Transaction = {
      ...baseTx,
      categoryId: 'cat_digital',
      note: 'Work Keyboard',
      ext: {
        'owned-items': { itemId: 'item_kb', itemRole: 'buy', kind: 'physical' },
      },
      updatedAt: '2026-11-21T09:00:00.000Z',
    };

    const base = createBaseExport();
    base.transactions.push(baseTx);
    const remote = createBaseExport();
    remote.transactions.push(baseTx);
    const local = createBaseExport();
    local.transactions.push(editedLocal);

    const plan = buildThreeWaySyncPlan(local, remote, base);
    expect(plan.requiresReview).toBe(false);
    expect(plan.pushItems).toHaveLength(1);
    expect(plan.conflictItems).toHaveLength(0);

    const resolved = resolveSyncPlan(plan, {});
    expect(resolved.merged.transactions).toHaveLength(1);
    expect(resolved.merged.transactions[0].id).toBe('ali_order_99');
    expect(resolved.merged.transactions[0].categoryId).toBe('cat_digital');
  });

  it('prefers the owned-items linked copy when cross-id normalized records match by core fields and createdAt', () => {
    const localEdited: Transaction = {
      id: 'tx_1001',
      type: 'expense',
      amount: 6800,
      accountId: 'acct_wx',
      categoryId: 'cat_food',
      date: '2026-11-20',
      note: 'Lunch box',
      ext: {
        'owned-items': { itemId: 'item_x', itemRole: 'buy', kind: 'physical' },
      },
      createdAt: '2026-11-20T19:00:00.000Z',
      updatedAt: '2026-11-21T10:00:00.000Z',
    };
    const remoteTwin: Transaction = {
      id: 'wx_999',
      type: 'expense',
      amount: 6800,
      accountId: 'acct_wx',
      categoryId: 'cat_food',
      date: '2026-11-20',
      note: 'Lunch box',
      createdAt: '2026-11-20T19:00:00.000Z',
      updatedAt: '2026-11-20T19:05:00.000Z',
    };

    const local = createBaseExport();
    local.transactions.push(localEdited);
    const remote = createBaseExport();
    remote.transactions.push(remoteTwin);

    const plan = buildThreeWaySyncPlan(local, remote, null);
    expect(plan.requiresReview).toBe(true);
    expect(plan.pushItems).toHaveLength(0);
    expect(plan.conflictItems).toHaveLength(1);
    expect(plan.conflictItems[0].reason).toBe('cross_id_duplicate');
    expect(plan.conflictItems[0].recommendedResolution).toBe('local');

    const resolved = resolveSyncPlan(plan, {}, { retainTombstones: true });
    const active = resolved.merged.transactions.filter((t) => !(t as StoredEntity).deletedAt);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('tx_1001');
  });
});
