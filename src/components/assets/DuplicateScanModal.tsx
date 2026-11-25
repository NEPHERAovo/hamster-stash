import React, { useEffect, useMemo, useState } from 'react';
import { TrashIcon as Trash2, CheckSquareIcon as CheckSquare, SquareIcon as Square } from '@phosphor-icons/react';
import { scanSuspectDuplicateGroups } from '../../domain/sync/duplicateScanner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { formatTime } from '../../utils/date';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export interface DuplicateScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicateScanModal: React.FC<DuplicateScanModalProps> = ({
  isOpen,
  onClose,
}) => {
  const allTransactions = useLedgerStore((s) => s.allTransactions);
  const transactions = useLedgerStore((s) => s.transactions);
  const deleteTransaction = useLedgerStore((s) => s.deleteTransaction);
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useCategoryStore((s) => s.categories);

  const sourceTxs = allTransactions.length > 0 ? allTransactions : transactions;
  const groups = useMemo(() => scanSuspectDuplicateGroups(sourceTxs), [sourceTxs]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const defaults = new Set<string>();
    for (const g of groups) {
      for (const id of g.recommendedDeleteIds) {
        defaults.add(id);
      }
    }
    setSelectedIds(defaults);
  }, [isOpen, groups]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCleanup = async () => {
    if (selectedIds.size === 0 || isCleaning) return;
    setIsCleaning(true);
    try {
      for (const id of selectedIds) {
        await deleteTransaction(id);
      }
      toast.success(`已清理 ${selectedIds.size} 笔重复账单，请执行同步更新云端`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '清理失败');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="重复账单排查"
    >
      <div className="space-y-3 p-4 text-xs">
        {groups.length === 0 ? (
          <div className="rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/40 py-8 text-center font-mono text-(--ink-tertiary)">
            未扫描到疑似重复账单
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between font-mono text-[11px] text-(--ink-tertiary)">
              <span>发现 {groups.length} 组疑似重复</span>
              <span>已勾选删除 {selectedIds.size} 笔</span>
            </div>

            <div className="max-h-80 space-y-2.5 overflow-y-auto pr-0.5">
              {groups.map((group) => {
                const amountPrefix = group.type === 'income' ? '+' : '-';
                return (
                  <div
                    key={group.groupKey}
                    className={cn(
                      'space-y-1.5 rounded-(--radius-sm) border bg-(--paper-sheet) p-2.5',
                      group.hasItemLinkConflict
                        ? 'border-(--color-expense)/40'
                        : 'border-(--rule-hairline)'
                    )}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-semibold text-(--ink-primary)">
                        {group.date} · {amountPrefix}¥{centsToYuan(group.amount)}
                      </span>
                      {group.hasItemLinkConflict && (
                        <span className="rounded-(--badge-radius) bg-(--color-expense-bg) px-1.5 py-0.5 text-[10px] text-(--color-expense)">
                          物品关联重复
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
                      {group.transactions.map((tx) => {
                        const checked = selectedIds.has(tx.id);
                        const acct = accounts.find((a) => a.id === tx.accountId);
                        const cat = categories.find((c) => c.id === tx.categoryId);
                        const owned = tx.ext?.['owned-items'] as { itemId?: string } | undefined;
                        return (
                          <PaperButton
                            key={tx.id}
                            type="button"
                            variant={checked ? 'sunken' : 'ghost'}
                            size="compact"
                            fullWidth
                            onClick={() => toggleId(tx.id)}
                            aria-label={`删除 ${tx.note || tx.id}`}
                            className={cn(
                              'h-auto justify-between gap-2 p-2 text-left font-normal',
                              checked && 'opacity-70'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {checked ? (
                                <CheckSquare weight="fill" className="size-4 shrink-0 text-(--color-expense)" />
                              ) : (
                                <Square className="size-4 shrink-0 text-(--ink-tertiary)" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium text-(--ink-primary)">
                                    {tx.note || cat?.name || '账单'}
                                  </span>
                                  {owned?.itemId && (
                                    <span className="shrink-0 rounded-(--badge-radius) bg-(--color-income-bg) px-1 py-0.5 font-mono text-[9px] text-(--color-income)">
                                      已关联物品
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-(--ink-tertiary)">
                                  {formatTime(tx.createdAt)} · {acct?.name || '账户'} · {cat?.name || '分类'}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-(--ink-tertiary)">
                              {checked ? '待删除' : '保留'}
                            </span>
                          </PaperButton>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-dashed border-(--rule-hairline) pt-2.5">
          <PaperButton
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isCleaning}
          >
            关闭
          </PaperButton>
          {groups.length > 0 && (
            <PaperButton
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="size-3.5" />}
              onClick={handleCleanup}
              disabled={selectedIds.size === 0 || isCleaning}
            >
              {isCleaning ? '清理中...' : `清理勾选 (${selectedIds.size})`}
            </PaperButton>
          )}
        </div>
      </div>
    </PaperModal>
  );
};
