import { describe, it, expect } from 'vitest';
import { scanSuspectDuplicateGroups } from '../../src/domain/sync/duplicateScanner';
import type { Transaction } from '../../src/types/transaction';

const makeTx = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
  type: 'expense',
  amount: 2000,
  accountId: 'acct_1',
  categoryId: 'cat_food',
  date: '2026-11-20',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

describe('duplicateScanner precision rules', () => {
  it('detects item-linked duplicate pairs even across default item category when normalized notes match', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx_unlinked',
        amount: 29900,
        categoryId: 'cat_fun',
        note: 'Mechanical Keyboard',
        createdAt: '2026-11-20T10:00:00.000Z',
      }),
      makeTx({
        id: 'tx_linked',
        amount: 29900,
        categoryId: 'cat_shop',
        note: '购入物品: Mechanical Keyboard',
        ext: { 'owned-items': { itemId: 'item_kbd', itemRole: 'buy', kind: 'physical' } },
        createdAt: '2026-11-20T19:00:00.000Z',
      }),
    ];

    const groups = scanSuspectDuplicateGroups(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchReason).toBe('item_link_pair');
    expect(groups[0].hasItemLinkConflict).toBe(true);
    expect(groups[0].recommendedKeepId).toBe('tx_linked');
    expect(groups[0].recommendedDeleteIds).toEqual(['tx_unlinked']);
  });

  it('detects same-item duplicates and sync clones with identical createdAt', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx_same_item_1',
        amount: 9900,
        categoryId: 'cat_shop',
        ext: { 'owned-items': { itemId: 'item_x', itemRole: 'maintenance' } },
        createdAt: '2026-11-20T11:00:00.000Z',
        updatedAt: '2026-11-20T11:00:00.000Z',
      }),
      makeTx({
        id: 'tx_same_item_2',
        amount: 9900,
        categoryId: 'cat_shop',
        ext: { 'owned-items': { itemId: 'item_x', itemRole: 'maintenance' } },
        createdAt: '2026-11-20T11:01:00.000Z',
        updatedAt: '2026-11-20T11:01:00.000Z',
      }),
      makeTx({
        id: 'tx_clone_1',
        amount: 4500,
        note: 'Lunch',
        createdAt: '2026-11-21T12:30:00.000Z',
        updatedAt: '2026-11-21T12:30:00.000Z',
      }),
      makeTx({
        id: 'tx_clone_2',
        amount: 4500,
        note: 'Lunch',
        date: '2026-11-21',
        createdAt: '2026-11-21T12:30:00.000Z',
        updatedAt: '2026-11-21T12:35:00.000Z',
      }),
    ];
    txs[2].date = '2026-11-21';

    const groups = scanSuspectDuplicateGroups(txs);
    expect(groups).toHaveLength(2);
    expect(groups[0].matchReason).toBe('same_item');
    expect(groups[1].matchReason).toBe('sync_clone');
  });

  it('ignores normal same-day same-amount transactions (morning/evening commute, different notes, different categories, distinct items)', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx_bus_am',
        amount: 200,
        categoryId: 'cat_transit',
        note: '地铁',
        createdAt: '2026-11-20T08:30:00.000Z',
      }),
      makeTx({
        id: 'tx_bus_pm',
        amount: 200,
        categoryId: 'cat_transit',
        note: '地铁',
        createdAt: '2026-11-20T18:30:00.000Z',
      }),
      makeTx({
        id: 'tx_coffee',
        amount: 3000,
        categoryId: 'cat_food',
        note: '星巴克',
        createdAt: '2026-11-20T09:00:00.000Z',
      }),
      makeTx({
        id: 'tx_cable_item',
        amount: 3000,
        categoryId: 'cat_shop',
        note: '购入物品: 数据线',
        ext: { 'owned-items': { itemId: 'item_cable', itemRole: 'buy' } },
        createdAt: '2026-11-20T09:01:00.000Z',
      }),
      makeTx({
        id: 'tx_diff_acct_1',
        amount: 1500,
        accountId: 'acct_1',
        note: '奶茶',
        createdAt: '2026-11-20T14:00:00.000Z',
      }),
      makeTx({
        id: 'tx_diff_acct_2',
        amount: 1500,
        accountId: 'acct_2',
        note: '奶茶',
        createdAt: '2026-11-20T14:01:00.000Z',
      }),
      makeTx({
        id: 'tx_item_a',
        amount: 5000,
        categoryId: 'cat_shop',
        ext: { 'owned-items': { itemId: 'item_a', itemRole: 'buy' } },
        createdAt: '2026-11-20T15:00:00.000Z',
      }),
      makeTx({
        id: 'tx_item_b',
        amount: 5000,
        categoryId: 'cat_shop',
        ext: { 'owned-items': { itemId: 'item_b', itemRole: 'buy' } },
        createdAt: '2026-11-20T15:01:00.000Z',
      }),
    ];

    expect(scanSuspectDuplicateGroups(txs)).toHaveLength(0);
  });

  it('clusters only truly matching burst pairs without pulling unrelated same-amount bills into the group', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx_burst_1',
        amount: 2500,
        note: '麦当劳',
        createdAt: '2026-11-20T12:00:00.000Z',
      }),
      makeTx({
        id: 'tx_burst_2',
        amount: 2500,
        note: '麦当劳',
        createdAt: '2026-11-20T12:02:00.000Z',
      }),
      makeTx({
        id: 'tx_normal_dinner',
        amount: 2500,
        note: '晚饭',
        createdAt: '2026-11-20T19:00:00.000Z',
      }),
    ];

    const groups = scanSuspectDuplicateGroups(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchReason).toBe('burst_duplicate');
    expect(groups[0].transactions.map((t) => t.id)).not.toContain('tx_normal_dinner');
  });
});
