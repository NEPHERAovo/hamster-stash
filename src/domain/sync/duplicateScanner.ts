import type { Transaction } from '../../types/transaction';

export type DuplicateMatchReason =
  | 'same_item'
  | 'item_link_pair'
  | 'sync_clone'
  | 'burst_duplicate';

export interface SuspectDuplicateGroup {
  groupKey: string;
  date: string;
  type: Transaction['type'];
  amount: number;
  transactions: Transaction[];
  recommendedKeepId: string;
  recommendedDeleteIds: string[];
  hasItemLinkConflict: boolean;
  matchReason: DuplicateMatchReason;
}

const ITEM_NOTE_PREFIX_RE = /^(?:购入物品|订阅支出|二手售出|物品收益)\s*[:：]\s*/;
const BURST_WINDOW_MS = 5 * 60 * 1000;

function getOwnedItemId(tx: Transaction): string | undefined {
  const owned = tx.ext?.['owned-items'] as { itemId?: string } | undefined;
  return owned?.itemId;
}

export function normalizeDuplicateNote(note?: string): string {
  return (note || '').trim().replace(ITEM_NOTE_PREFIX_RE, '').trim().toLowerCase();
}

function areNotesCompatible(normA: string, normB: string): boolean {
  if (!normA || !normB) return true;
  if (normA === normB) return true;
  return normA.includes(normB) || normB.includes(normA);
}

function getCreatedTimeMs(tx: Transaction): number | null {
  const raw = tx.createdAt || tx.updatedAt;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

function classifyDuplicatePair(a: Transaction, b: Transaction): DuplicateMatchReason | null {
  if (a.type === 'reconcile' || b.type === 'reconcile') return null;
  if (a.type === 'transfer' && a.toAccountId !== b.toAccountId) return null;

  const linkA = getOwnedItemId(a);
  const linkB = getOwnedItemId(b);
  if (linkA && linkB && linkA !== linkB) return null;

  const normA = normalizeDuplicateNote(a.note);
  const normB = normalizeDuplicateNote(b.note);
  if (!areNotesCompatible(normA, normB)) return null;

  const sameAccount = a.accountId === b.accountId;
  const sameCategory = a.categoryId === b.categoryId;
  const exactNotesEqual = Boolean(normA) && normA === normB;

  const msA = getCreatedTimeMs(a);
  const msB = getCreatedTimeMs(b);
  const sameCreatedAt = Boolean(a.createdAt && b.createdAt && a.createdAt === b.createdAt);
  const withinBurst = msA !== null && msB !== null && Math.abs(msA - msB) <= BURST_WINDOW_MS;

  if (linkA || linkB) {
    if (linkA && linkB && linkA === linkB) return 'same_item';
    if (exactNotesEqual) return 'item_link_pair';
    if (sameAccount && sameCategory) return 'item_link_pair';
    if (sameAccount && withinBurst) return 'item_link_pair';
    return null;
  }

  if (!sameAccount || !sameCategory || normA !== normB) return null;
  if (sameCreatedAt) return 'sync_clone';
  if (withinBurst) return 'burst_duplicate';
  return null;
}

function scoreKeepPriority(tx: Transaction): number {
  let score = 0;
  if (getOwnedItemId(tx)) score += 100;
  if (tx.offsetTransactionId) score += 20;
  if (tx.voucher?.attachmentId || tx.voucher?.fileUrl) score += 10;
  if (tx.note && tx.note.trim()) score += 5;
  return score;
}

function pickPrimaryReason(reasons: DuplicateMatchReason[]): DuplicateMatchReason {
  if (reasons.includes('same_item')) return 'same_item';
  if (reasons.includes('item_link_pair')) return 'item_link_pair';
  if (reasons.includes('sync_clone')) return 'sync_clone';
  return 'burst_duplicate';
}

function clusterMatchedComponents(bucket: Transaction[]): Array<{
  transactions: Transaction[];
  matchReason: DuplicateMatchReason;
}> {
  const n = bucket.length;
  const adj: Array<Array<{ to: number; reason: DuplicateMatchReason }>> = Array.from(
    { length: n },
    () => []
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const reason = classifyDuplicatePair(bucket[i], bucket[j]);
      if (reason) {
        adj[i].push({ to: j, reason });
        adj[j].push({ to: i, reason });
      }
    }
  }

  const visited = new Array<boolean>(n).fill(false);
  const components: Array<{ transactions: Transaction[]; matchReason: DuplicateMatchReason }> = [];

  for (let i = 0; i < n; i++) {
    if (visited[i] || adj[i].length === 0) continue;

    const queue = [i];
    visited[i] = true;
    const indices: number[] = [];
    const reasons: DuplicateMatchReason[] = [];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      indices.push(cur);
      for (const edge of adj[cur]) {
        reasons.push(edge.reason);
        if (!visited[edge.to]) {
          visited[edge.to] = true;
          queue.push(edge.to);
        }
      }
    }

    if (indices.length >= 2) {
      components.push({
        transactions: indices.map((idx) => bucket[idx]),
        matchReason: pickPrimaryReason(reasons),
      });
    }
  }

  return components;
}

export function scanSuspectDuplicateGroups(
  transactions: Transaction[]
): SuspectDuplicateGroup[] {
  const buckets = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if ((tx as { deletedAt?: string }).deletedAt) continue;
    if (tx.type === 'reconcile') continue;
    const key = `${tx.date}|${tx.type}|${tx.amount}`;
    const list = buckets.get(key);
    if (list) {
      list.push(tx);
    } else {
      buckets.set(key, [tx]);
    }
  }

  const groups: SuspectDuplicateGroup[] = [];

  for (const [baseKey, bucket] of buckets.entries()) {
    if (bucket.length < 2) continue;

    const components = clusterMatchedComponents(bucket);
    components.forEach((component, idx) => {
      const sorted = [...component.transactions].sort((a, b) => {
        const scoreDiff = scoreKeepPriority(b) - scoreKeepPriority(a);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.updatedAt || b.createdAt || '').localeCompare(
          a.updatedAt || a.createdAt || ''
        );
      });

      const linkedCount = sorted.filter((t) => Boolean(getOwnedItemId(t))).length;
      const hasItemLinkConflict =
        component.matchReason === 'same_item' ||
        (linkedCount > 0 && linkedCount < sorted.length);

      const [keep, ...rest] = sorted;
      groups.push({
        groupKey: `${baseKey}#${idx}`,
        date: keep.date,
        type: keep.type,
        amount: keep.amount,
        transactions: sorted,
        recommendedKeepId: keep.id,
        recommendedDeleteIds: rest.map((t) => t.id),
        hasItemLinkConflict,
        matchReason: component.matchReason,
      });
    });
  }

  const reasonRank: Record<DuplicateMatchReason, number> = {
    same_item: 0,
    item_link_pair: 1,
    sync_clone: 2,
    burst_duplicate: 3,
  };

  groups.sort((a, b) => {
    const rankDiff = reasonRank[a.matchReason] - reasonRank[b.matchReason];
    if (rankDiff !== 0) return rankDiff;
    return b.date.localeCompare(a.date);
  });

  return groups;
}
