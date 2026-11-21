import React, { useState } from 'react';
import { WarningIcon as AlertTriangle } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { toast } from '../../stores/useToastStore';

export interface ClearAllDataModalProps {
  isOpen: boolean;
  transactionCount: number;
  accountCount: number;
  onClose: () => void;
  onRequestBackup: () => void;
  onConfirmClear: () => Promise<void>;
}

const CONFIRM_PHRASE = '清空数据';

export const ClearAllDataModal: React.FC<ClearAllDataModalProps> = ({
  isOpen,
  transactionCount,
  accountCount,
  onClose,
  onRequestBackup,
  onConfirmClear,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmInput, setConfirmInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleClose = () => {
    setStep(1);
    setConfirmInput('');
    onClose();
  };

  const isPhraseMatched = confirmInput.trim() === CONFIRM_PHRASE;

  const handleExecuteClear = async () => {
    if (!isPhraseMatched || isClearing) return;
    setIsClearing(true);
    try {
      await onConfirmClear();
      toast.success('已清空所有本地数据并恢复初始状态');
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '清空数据失败');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? '清空所有数据（第 1/2 步）' : '最终确认清空（第 2/2 步）'}
      subtitle="危险操作 · 不可撤销"
    >
      <div className="space-y-4 p-4 select-none">
        {step === 1 ? (
          <>
            <div className="flex items-start gap-2.5 rounded-(--radius-sm) border border-(--color-expense)/30 bg-(--color-expense-bg) p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-2 text-(--color-expense)" />
              <div className="space-y-1 text-xs leading-relaxed text-(--color-expense)">
                <p className="font-semibold">此操作将永久删除当前设备上的全部本地数据：</p>
                <p>
                  包含 {transactionCount} 笔流水、{accountCount} 个资金账户、自定义分类及全部插件物品记录，并重置为初始空账本。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                handleClose();
                onRequestBackup();
              }}
              className="w-full cursor-pointer py-2 font-mono text-xs text-(--color-accent) hover:underline"
            >
              先导出一次全量备份 →
            </button>

            <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--color-expense) text-xs font-semibold text-white"
              >
                我已了解，继续清空
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-(--ink-secondary)">
                为防止误操作，请在下方输入框中完整输入{' '}
                <span className="rounded-(--badge-radius) bg-(--color-expense-bg) px-1.5 py-0.5 font-mono font-bold text-(--color-expense)">
                  {CONFIRM_PHRASE}
                </span>{' '}
                以解锁清空按钮：
              </p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.key === 'Process' || e.keyCode === 229) return;
                  if (e.key === 'Enter' && isPhraseMatched) {
                    void handleExecuteClear();
                  }
                }}
                placeholder={`请输入 ${CONFIRM_PHRASE}`}
                autoFocus
                className="h-10 w-full rounded-(--input-radius) border border-(--color-expense)/40 bg-(--paper-sunken) px-3 font-mono text-sm text-(--ink-primary) outline-none placeholder:text-(--ink-faint) focus:border-(--color-expense)"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setConfirmInput('');
                }}
                className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
              >
                返回上一步
              </button>
              <button
                type="button"
                disabled={!isPhraseMatched || isClearing}
                onClick={handleExecuteClear}
                className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--color-expense) text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isClearing ? '清空中...' : '永久清空所有数据'}
              </button>
            </div>
          </>
        )}
      </div>
    </PaperModal>
  );
};

export default ClearAllDataModal;
