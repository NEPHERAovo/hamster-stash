import React, { useState } from 'react';
import type { Account } from '../../types/account';
import { PaperModal } from '../ui/PaperModal';
import { PaperCard } from '../ui/PaperCard';
import { PaperButton } from '../ui/PaperButton';
import { centsToYuan, yuanToCents } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../utils/cn';
import { todayDate } from '../../utils/date';

export interface ReconcileModalProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReconcileModal: React.FC<ReconcileModalProps> = ({
  account,
  isOpen,
  onClose,
}) => {
  const { reconcileAccount } = useLedgerStore();
  const [targetYuan, setTargetYuan] = useState('');
  const [loading, setLoading] = useState(false);

  if (!account) return null;

  const currentCents = account.balance;
  const targetCents = yuanToCents(targetYuan || '0');
  const diffCents = targetCents - currentCents;

  const handleConfirm = async () => {
    if (!targetYuan.trim()) return;
    setLoading(true);
    try {
      const today = todayDate();
      await reconcileAccount({
        accountId: account.id,
        targetBalance: targetCents,
        date: today,
        note: `对账校准 (${account.name})`,
      });
      setTargetYuan('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title={`平账校准 · ${account.name}`}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between py-2 px-3 bg-(--paper-sunken) rounded-(--radius-sm) text-xs">
          <span className="text-(--ink-tertiary)">当前余额:</span>
          <span className="font-bold text-(--ink-primary) tabular-nums">
            ¥ {centsToYuan(currentCents)}
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-(--ink-secondary) block">
            实际清点金额 (元)
          </label>
          <div className="flex items-center h-12 px-3 bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) focus-within:border-(--ink-primary)">
            <span className="text-lg font-bold text-(--ink-secondary) mr-2">¥</span>
            <input
              type="number"
              step="0.01"
              placeholder={centsToYuan(currentCents)}
              value={targetYuan}
              onChange={(e) => setTargetYuan(e.target.value)}
              className="flex-1 bg-transparent text-xl font-bold tabular-nums outline-none text-(--ink-primary)"
            />
          </div>
        </div>

        {targetYuan.trim() !== '' && (
          <PaperCard
            variant="default"
            padding="sm"
            className="flex items-center justify-between text-xs"
          >
            <span className="text-(--ink-tertiary)">平账差额联动:</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                diffCents > 0
                  ? 'text-(--color-income)'
                  : diffCents < 0
                  ? 'text-(--color-expense)'
                  : 'text-(--ink-secondary)'
              )}
            >
              {diffCents > 0
                ? `+ ¥ ${centsToYuan(diffCents)} (调增)`
                : diffCents < 0
                ? `- ¥ ${centsToYuan(Math.abs(diffCents))} (调减)`
                : '无差异'}
            </span>
          </PaperCard>
        )}

        <div className="pt-2 flex gap-2">
          <PaperButton variant="ghost" fullWidth onClick={onClose}>
            取消
          </PaperButton>
          <PaperButton
            variant="ink"
            fullWidth
            loading={loading}
            disabled={!targetYuan.trim()}
            onClick={handleConfirm}
          >
            确认校准平账
          </PaperButton>
        </div>
      </div>
    </PaperModal>
  );
};

export default ReconcileModal;
