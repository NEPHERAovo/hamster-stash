import React, { useEffect, useMemo, useState } from 'react';
import type { SyncDiffItem, SyncDiffPlan, SyncResolutionChoice } from '../../domain/sync/diffMerger';
import type { Transaction } from '../../types/transaction';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { cn } from '../../utils/cn';

export interface SyncReviewModalProps {
  isOpen: boolean;
  plan: SyncDiffPlan | null;
  onClose: () => void;
  onConfirm: (resolutions: Record<string, SyncResolutionChoice>) => Promise<void>;
}

function formatKindLabel(kind: SyncDiffItem['kind']): string {
  if (kind === 'add') return '新增';
  if (kind === 'delete') return '删除';
  return '修改';
}

function formatReasonLabel(item: SyncDiffItem): string {
  if (item.reason === 'cross_id_duplicate') return '同消费双份';
  if (item.reason === 'both_modified') return '两端冲突';
  if (item.reason === 'no_base_diverged') return '数据不一致';
  return '云端下发';
}

function getTxOwnedLabel(tx: Transaction | undefined): string {
  const owned = tx?.ext?.['owned-items'] as { itemId?: string } | undefined;
  return owned?.itemId ? '含物品关联' : '';
}

function formatEntityHeadline(item: SyncDiffItem): string {
  const entity = (item.remoteEntity || item.localEntity) as Record<string, unknown> | undefined;
  if (item.collection === 'transactions') {
    const tx = entity as unknown as Transaction | undefined;
    const prefix = tx?.type === 'income' ? '+' : '-';
    const amount = tx?.amount !== undefined ? `${prefix}¥${centsToYuan(tx.amount)}` : '';
    const title = tx?.note || tx?.date || item.id;
    return [tx?.date, title, amount].filter(Boolean).join(' · ');
  }
  if (item.collection === 'accounts') {
    const acct = entity as unknown as Account | undefined;
    return `账户: ${acct?.name || item.id}`;
  }
  if (item.collection === 'categories') {
    const cat = entity as unknown as Category | undefined;
    return `分类: ${cat?.name || item.id}`;
  }
  if (item.collection === 'plugin_data') {
    const data = entity?.data as { name?: string } | undefined;
    return `物品数据: ${data?.name || item.id}`;
  }
  return `配置: ${item.id}`;
}

function formatSideSummary(
  collection: SyncDiffItem['collection'],
  entity: Record<string, unknown> | undefined
): string {
  if (!entity) return '无记录';
  if (entity.deletedAt) return '已删除';
  if (collection === 'transactions') {
    const tx = entity as unknown as Transaction;
    const amount = `${tx.type === 'income' ? '+' : '-'}¥${centsToYuan(tx.amount)}`;
    const parts = [tx.date, amount, tx.note || '无备注', getTxOwnedLabel(tx)].filter(Boolean);
    return parts.join(' · ');
  }
  if (collection === 'accounts') {
    const acct = entity as unknown as Account;
    return `${acct.name} · ¥${centsToYuan(acct.balance)}`;
  }
  if (collection === 'categories') {
    const cat = entity as unknown as Category;
    return cat.name;
  }
  if (collection === 'plugin_data') {
    const data = entity.data as { name?: string; status?: string } | undefined;
    return [data?.name || '插件条目', data?.status].filter(Boolean).join(' · ');
  }
  return '已更新';
}

export const SyncReviewModal: React.FC<SyncReviewModalProps> = ({
  isOpen,
  plan,
  onClose,
  onConfirm,
}) => {
  const reviewItems = useMemo(() => {
    if (!plan) return [];
    return [...plan.conflictItems, ...plan.incomingItems];
  }, [plan]);

  const [resolutions, setResolutions] = useState<Record<string, SyncResolutionChoice>>({});
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!plan) return;
    const initial: Record<string, SyncResolutionChoice> = {};
    for (const item of [...plan.conflictItems, ...plan.incomingItems]) {
      initial[item.key] = item.recommendedResolution;
    }
    setResolutions(initial);
  }, [plan]);

  const handleSelectAll = (choice: SyncResolutionChoice) => {
    const next: Record<string, SyncResolutionChoice> = {};
    for (const item of reviewItems) {
      next[item.key] = choice;
    }
    setResolutions(next);
  };

  const handleConfirm = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      await onConfirm(resolutions);
    } finally {
      setIsApplying(false);
    }
  };

  const conflictCount = plan?.conflictItems.length || 0;
  const incomingCount = plan?.incomingItems.length || 0;
  const pushCount = plan?.pushItems.length || 0;

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="云端变更确认"
    >
      <div className="space-y-3 p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken)/60 p-2.5">
          <div className="font-mono text-[11px] text-(--ink-secondary)">
            <span>冲突 {conflictCount}</span>
            <span className="mx-1.5 text-(--ink-faint)">·</span>
            <span>云端下发 {incomingCount}</span>
            <span className="mx-1.5 text-(--ink-faint)">·</span>
            <span>本地待推 {pushCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PaperButton
              size="xs"
              variant="secondary"
              onClick={() => handleSelectAll('remote')}
              disabled={isApplying}
            >
              全部采用云端
            </PaperButton>
            <PaperButton
              size="xs"
              variant="secondary"
              onClick={() => handleSelectAll('local')}
              disabled={isApplying}
            >
              全部保留本地
            </PaperButton>
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
          {reviewItems.map((item) => {
            const currentChoice = resolutions[item.key] || item.recommendedResolution;
            const isConflict = item.source === 'conflict';
            return (
              <div
                key={item.key}
                className={cn(
                  'space-y-2 rounded-(--radius-sm) border bg-(--paper-sheet) p-2.5',
                  isConflict ? 'border-(--color-expense)/40' : 'border-(--rule-hairline)'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-(--ink-primary)">
                    {formatEntityHeadline(item)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-(--badge-radius) px-1.5 py-0.5 font-mono text-[10px]',
                      isConflict
                        ? 'bg-(--color-expense-bg) text-(--color-expense)'
                        : 'bg-(--color-income-bg) text-(--color-income)'
                    )}
                  >
                    {formatReasonLabel(item)} · {formatKindLabel(item.kind)}
                  </span>
                </div>

                <div className="space-y-1 rounded-(--radius-xs) bg-(--paper-sunken)/50 p-2 font-mono text-[10px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-(--ink-tertiary)">本地</span>
                    <span className="truncate text-(--ink-secondary)">
                      {formatSideSummary(
                        item.collection,
                        item.localEntity as Record<string, unknown> | undefined
                      )}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-(--ink-tertiary)">云端</span>
                    <span className="truncate text-(--ink-primary)">
                      {formatSideSummary(
                        item.collection,
                        item.remoteEntity as Record<string, unknown> | undefined
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <PaperButton
                    size="xs"
                    variant={currentChoice === 'local' ? 'primary' : 'sunken'}
                    onClick={() =>
                      setResolutions((prev) => ({ ...prev, [item.key]: 'local' }))
                    }
                    disabled={isApplying}
                  >
                    保留本地
                  </PaperButton>
                  <PaperButton
                    size="xs"
                    variant={currentChoice === 'remote' ? 'income' : 'sunken'}
                    onClick={() =>
                      setResolutions((prev) => ({ ...prev, [item.key]: 'remote' }))
                    }
                    disabled={isApplying}
                  >
                    采用云端
                  </PaperButton>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-dashed border-(--rule-hairline) pt-2.5">
          <PaperButton
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isApplying}
          >
            暂不同步
          </PaperButton>
          <PaperButton
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isApplying || reviewItems.length === 0}
          >
            {isApplying ? '应用中...' : '确认合并'}
          </PaperButton>
        </div>
      </div>
    </PaperModal>
  );
};
