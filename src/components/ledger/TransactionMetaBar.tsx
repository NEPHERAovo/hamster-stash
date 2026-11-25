import React from 'react';
import { PaperclipIcon as Paperclip, CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction, VoucherAttachment } from '../../types/transaction';
import type { PendingSettlementSummary } from '../../domain/transaction/transactionService';
import { PaperButton } from '../ui/PaperButton';
import { PaperChip } from '../ui/PaperChip';
import { PaperSelect } from '../ui/PaperSelect';
import { OffsetTrayPanel } from './OffsetTrayPanel';
import { AmortizeTrayPanel } from './AmortizeTrayPanel';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';

export interface TransactionMetaBarProps {
  txType: 'expense' | 'income' | 'loan';
  expr: string;
  accounts: Account[];
  categories: Category[];
  selectedAcctId: string;
  onSelectAccount: (id: string) => void;
  formattedDateStr: string;
  timeStr: string;
  isReimbursementEnabled: boolean;
  isReimbursable: boolean;
  onToggleReimbursable: () => void;
  isAmortizationEnabled: boolean;
  amortizeMonths: number | null;
  isCustomAmortize: boolean;
  customAmortizeInput: string;
  onSelectAmortizeMonths: (months: number | null) => void;
  onCustomAmortizeToggle: (active: boolean, initVal: string) => void;
  onCustomAmortizeChange: (val: string) => void;
  voucher: VoucherAttachment | null;
  onRemoveVoucher: () => void;
  onOpenVoucherPreview: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  offsetTransactionId: string | undefined;
  selectedOffsetTx: Transaction | null;
  candidateExpenses: Transaction[];
  offsetSummaryMap: Map<string, number>;
  onSelectOffsetExpense: (tx: Transaction) => void;
  onClearOffsetExpense: () => void;
  loanRole: 'origin' | 'repayment';
  settlementSummary?: PendingSettlementSummary;
  relatedLoanId: string;
  onChangeRelatedLoanId: (id: string) => void;
  isAcctTrayOpen: boolean;
  onToggleAcctTray: () => void;
  isDateTimePickerOpen: boolean;
  onOpenDateTimePicker: () => void;
  isVoucherTrayOpen: boolean;
  onToggleVoucherTray: () => void;
  isAmortizeTrayOpen: boolean;
  onToggleAmortizeTray: () => void;
  isOffsetTrayOpen: boolean;
  onToggleOffsetTray: () => void;
  modalContext: Record<string, unknown>;
}

export const TransactionMetaBar: React.FC<TransactionMetaBarProps> = ({
  txType,
  expr,
  accounts,
  categories,
  selectedAcctId,
  onSelectAccount,
  formattedDateStr,
  timeStr,
  isReimbursementEnabled,
  isReimbursable,
  onToggleReimbursable,
  isAmortizationEnabled,
  amortizeMonths,
  isCustomAmortize,
  customAmortizeInput,
  onSelectAmortizeMonths,
  onCustomAmortizeToggle,
  onCustomAmortizeChange,
  voucher,
  onRemoveVoucher,
  onOpenVoucherPreview,
  fileInputRef,
  onFileChange,
  offsetTransactionId,
  selectedOffsetTx,
  candidateExpenses,
  offsetSummaryMap,
  onSelectOffsetExpense,
  onClearOffsetExpense,
  loanRole,
  settlementSummary,
  relatedLoanId,
  onChangeRelatedLoanId,
  isAcctTrayOpen,
  onToggleAcctTray,
  isDateTimePickerOpen,
  onOpenDateTimePicker,
  isVoucherTrayOpen,
  onToggleVoucherTray,
  isAmortizeTrayOpen,
  onToggleAmortizeTray,
  isOffsetTrayOpen,
  onToggleOffsetTray,
  modalContext,
}) => {
  const activeAccount = accounts.find((a) => a.id === selectedAcctId);

  return (
    <div className="space-y-1.5 border-y border-dashed border-(--rule-hairline) px-4 py-1.5">
      <div className="metadata-bar no-scrollbar flex min-w-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto font-mono text-xs select-none">
        <PaperChip
          selected={isAcctTrayOpen}
          rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
          className="max-w-28 shrink-0"
          onClick={onToggleAcctTray}
        >
          <span className="max-w-20 truncate">{activeAccount?.name || '选择账户'}</span>
        </PaperChip>

        <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>

        <PaperChip
          selected={isDateTimePickerOpen}
          rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
          className="shrink-0"
          onClick={onOpenDateTimePicker}
        >
          <span className="shrink-0">{formattedDateStr} {timeStr}</span>
        </PaperChip>

        {txType === 'expense' && (
          <>
            <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
            {(isReimbursementEnabled || isReimbursable) && (
              <PaperChip
                variant="expense"
                selected={isReimbursable}
                className="shrink-0"
                onClick={onToggleReimbursable}
              >
                {isReimbursable ? '待报销 ✓' : '报销'}
              </PaperChip>
            )}

            {(isReimbursable || Boolean(voucher)) && (
              <>
                <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                <PaperChip
                  variant={voucher ? 'brass' : 'default'}
                  selected={Boolean(voucher)}
                  leftIcon={<Paperclip className="size-3 stroke-2" />}
                  title={voucher ? voucher.name : '添加凭证附件'}
                  className="max-w-28 shrink-0"
                  onClick={() => {
                    if (voucher) {
                      onToggleVoucherTray();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <span className="max-w-20 truncate">{voucher ? voucher.name || '已附凭证' : '凭证'}</span>
                </PaperChip>
              </>
            )}

            {(isAmortizationEnabled || Boolean(amortizeMonths)) && (
              <>
                <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                <PaperChip
                  selected={Boolean(amortizeMonths) || isAmortizeTrayOpen}
                  rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
                  className="shrink-0"
                  onClick={onToggleAmortizeTray}
                >
                  <span className="shrink-0">{amortizeMonths ? `分期: ${amortizeMonths}期` : '分期'}</span>
                </PaperChip>
              </>
            )}
          </>
        )}

        {txType === 'income' && (
          <>
            <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
            <PaperChip
              variant="income"
              selected={Boolean(offsetTransactionId) || isOffsetTrayOpen}
              rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
              className="max-w-36 shrink-0"
              onClick={onToggleOffsetTray}
            >
              <span className="max-w-26 truncate">
                {selectedOffsetTx
                  ? `抵扣 · ${selectedOffsetTx.note || categories.find((c) => c.id === selectedOffsetTx.categoryId)?.name || '支出'}`
                  : '抵扣支出'}
              </span>
            </PaperChip>
          </>
        )}

        <PluginSlot name="tx.modal.metaBar" context={modalContext} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
        accept="image/*,.pdf"
      />

      {isVoucherTrayOpen && voucher && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-(--ink-primary)">{voucher.name}</div>
            <div className="text-[10px] text-(--ink-tertiary)">{voucher.size}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PaperButton variant="primary" size="xs" onClick={onOpenVoucherPreview}>
              查看
            </PaperButton>
            <PaperButton variant="secondary" size="xs" onClick={() => fileInputRef.current?.click()}>
              更换
            </PaperButton>
            <PaperButton variant="danger" size="xs" onClick={onRemoveVoucher}>
              移除
            </PaperButton>
          </div>
        </div>
      )}

      {isAcctTrayOpen && (
        <div className="picker-fade-enter border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {accounts.map((a) => (
              <PaperChip
                key={a.id}
                selected={selectedAcctId === a.id}
                onClick={() => onSelectAccount(a.id)}
                className="max-w-36"
              >
                {a.name}
              </PaperChip>
            ))}
          </div>
        </div>
      )}

      {txType === 'expense' && isAmortizeTrayOpen && (
        <AmortizeTrayPanel
          expr={expr}
          amortizeMonths={amortizeMonths}
          isCustomAmortize={isCustomAmortize}
          customAmortizeInput={customAmortizeInput}
          onSelectMonths={onSelectAmortizeMonths}
          onCustomAmortizeToggle={onCustomAmortizeToggle}
          onCustomAmortizeChange={onCustomAmortizeChange}
        />
      )}

      {txType === 'income' && isOffsetTrayOpen && (
        <OffsetTrayPanel
          candidateExpenses={candidateExpenses}
          categories={categories}
          offsetTransactionId={offsetTransactionId}
          offsetSummaryMap={offsetSummaryMap}
          onSelectOffsetExpense={onSelectOffsetExpense}
          onClearOffsetExpense={onClearOffsetExpense}
        />
      )}

      <PluginSlot name="tx.modal.metaTray" context={modalContext} />

      {txType === 'loan' && loanRole === 'repayment' && settlementSummary && (
        <div className="pt-1 font-mono text-[11px] text-(--ink-secondary)">
          <div className="flex items-center gap-1.5">
            <span className="text-(--ink-tertiary)">关联借据:</span>
            <PaperSelect
              value={relatedLoanId}
              onChange={(e) => onChangeRelatedLoanId(e.target.value)}
              className="py-1 text-xs"
            >
              <option value="none">无关联 (单笔独立借贷)</option>
              {settlementSummary.pendingLoans.map((l: Transaction) => (
                <option key={l.id} value={l.id}>
                  {l.note || l.loanParty || '借款'} (¥{((l.amount - (l.repaidAmount || 0)) / 100).toFixed(2)})
                </option>
              ))}
            </PaperSelect>
          </div>
        </div>
      )}
    </div>
  );
};
