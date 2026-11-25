import { describe, it, expect } from 'vitest';
import { scanSuspectDuplicateGroups } from '../../src/domain/sync/duplicateScanner';
import type { Transaction } from '../../src/types/transaction';

describe('duplicateScanner', () => {
  it('groups same-date same-amount duplicates and prioritizes keeping item-linked transactions', () => {
    const txs: Transaction[] = [
      {
        id: 'tx_unlinked',
        type: 'expense',
        amount: 29900,
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-11-20',
        note: 'Mechanical Keyboard',
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 'tx_linked',
        type: 'expense',
        amount: 29900,
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-11-20',
        note: '购入物品: Mechanical Keyboard',
        ext: { 'owned-items': { itemId: 'item_kbd', itemRole: 'buy', kind: 'physical' } },
        createdAt: '2026-11-20T10:02:00.000Z',
        updatedAt: '2026-11-20T10:02:00.000Z',
      },
      {
        id: 'tx_distinct',
        type: 'expense',
        amount: 3500,
        accountId: 'acct_1',
        categoryId: 'cat_food',
        date: '2026-11-20',
        note: 'Lunch',
        createdAt: '2026-11-20T12:00:00.000Z',
        updatedAt: '2026-11-20T12:00:00.000Z',
      },
    ];

    const groups = scanSuspectDuplicateGroups(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0].hasItemLinkConflict).toBe(true);
    expect(groups[0].recommendedKeepId).toBe('tx_linked');
    expect(groups[0].recommendedDeleteIds).toEqual(['tx_unlinked']);
  });
});
