import React, { useState } from 'react';
import { Warning as AlertTriangle } from '@phosphor-icons/react';
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
      <div className="p-4 space-y-4 select-none">
        {step === 1 ? (
          <>
            <div className="p-3 rounded-(--radius-sm) bg-(--color-expense-bg) border border-(--color-expense)/30 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-(--color-expense) shrink-0 mt-0.5 stroke-2" />
              <div className="text-xs text-(--color-expense) leading-relaxed space-y-1">
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
              className="w-full py-2 text-xs font-mono text-(--color-accent) hover:underline cursor-pointer"
            >
              先导出一次全量备份 →
            </button>

            <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 h-10 rounded-(--btn-radius) bg-(--color-expense) text-white text-xs font-semibold cursor-pointer"
              >
                我已了解，继续清空
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-(--ink-secondary) leading-relaxed">
                为防止误操作，请在下方输入框中完整输入{' '}
                <span className="px-1.5 py-0.5 rounded-(--badge-radius) bg-(--color-expense-bg) text-(--color-expense) font-mono font-bold">
                  {CONFIRM_PHRASE}
                </span>{' '}
                以解锁清空按钮：
              </p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isPhraseMatched) {
                    void handleExecuteClear();
                  }
                }}
                placeholder={`请输入 ${CONFIRM_PHRASE}`}
                autoFocus
                className="w-full h-10 px-3 text-sm font-mono rounded-(--input-radius) bg-(--paper-sunken) border border-(--color-expense)/40 text-(--ink-primary) placeholder:text-(--ink-faint) outline-none focus:border-(--color-expense)"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setConfirmInput('');
                }}
                className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
              >
                返回上一步
              </button>
              <button
                type="button"
                disabled={!isPhraseMatched || isClearing}
                onClick={handleExecuteClear}
                className="flex-1 h-10 rounded-(--btn-radius) bg-(--color-expense) text-white text-xs font-semibold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
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
