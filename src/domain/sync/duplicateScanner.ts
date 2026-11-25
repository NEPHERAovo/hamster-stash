import type { Transaction } from '../../types/transaction';

export interface SuspectDuplicateGroup {
  groupKey: string;
  date: string;
  type: Transaction['type'];
  amount: number;
  transactions: Transaction[];
  recommendedKeepId: string;
  recommendedDeleteIds: string[];
  hasItemLinkConflict: boolean;
}

function getOwnedItemId(tx: Transaction): string | undefined {
  const owned = tx.ext?.['owned-items'] as { itemId?: string } | undefined;
  return owned?.itemId;
}

function scoreKeepPriority(tx: Transaction): number {
  let score = 0;
  if (getOwnedItemId(tx)) score += 100;
  if (tx.offsetTransactionId) score += 20;
  if (tx.voucher?.attachmentId || tx.voucher?.fileUrl) score += 10;
  if (tx.note && tx.note.trim()) score += 5;
  return score;
}

export function scanSuspectDuplicateGroups(
  transactions: Transaction[]
): SuspectDuplicateGroup[] {
  const buckets = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if ((tx as { deletedAt?: string }).deletedAt) continue;
    const key = `${tx.date}|${tx.type}|${tx.amount}`;
    const list = buckets.get(key);
    if (list) {
      list.push(tx);
    } else {
      buckets.set(key, [tx]);
    }
  }

  const groups: SuspectDuplicateGroup[] = [];

  for (const [groupKey, list] of buckets.entries()) {
    if (list.length < 2) continue;

    const sorted = [...list].sort((a, b) => {
      const scoreDiff = scoreKeepPriority(b) - scoreKeepPriority(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.updatedAt || b.createdAt || '').localeCompare(
        a.updatedAt || a.createdAt || ''
      );
    });

    const linkedCount = sorted.filter((t) => Boolean(getOwnedItemId(t))).length;
    const hasItemLinkConflict = linkedCount > 0 && linkedCount < sorted.length;

    const [keep, ...rest] = sorted;
    groups.push({
      groupKey,
      date: keep.date,
      type: keep.type,
      amount: keep.amount,
      transactions: sorted,
      recommendedKeepId: keep.id,
      recommendedDeleteIds: rest.map((t) => t.id),
      hasItemLinkConflict,
    });
  }

  groups.sort((a, b) => {
    if (a.hasItemLinkConflict !== b.hasItemLinkConflict) {
      return a.hasItemLinkConflict ? -1 : 1;
    }
    return b.date.localeCompare(a.date);
  });

  return groups;
}
