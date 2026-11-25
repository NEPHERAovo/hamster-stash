import React from 'react';
import { MagnifyingGlassIcon as Search, CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react';
import {
  centsToYuan,
  getCategoryIcon,
  cn,
  PaperButton,
  PaperInput,
  PaperSelect,
  AmountInput,
  SegToggle,
  PaperDatePickerModal,
  type Account,
  type Category,
  type Transaction,
} from '../../../plugin-sdk';

export interface ItemBillPanelProps {
  isSub: boolean;
  billRole: 'maintenance' | 'profit';
  onChangeBillRole: (role: 'maintenance' | 'profit') => void;
  billSource: 'existing' | 'new';
  onChangeBillSource: (source: 'existing' | 'new') => void;
  searchBillQuery: string;
  onChangeSearchBillQuery: (query: string) => void;
  candidateExpenses: Transaction[];
  candidateIncomeTxs: Transaction[];
  accounts: Account[];
  hostCategories: Category[];
  billPriceYuan: string;
  onChangeBillPriceYuan: (val: string) => void;
  billAccountId: string;
  onChangeBillAccountId: (id: string) => void;
  billDate: string;
  onChangeBillDate: (date: string) => void;
  isBillDateOpen: boolean;
  onOpenBillDate: (open: boolean) => void;
  billNote: string;
  onChangeBillNote: (note: string) => void;
  isSubmittingBill: boolean;
  onLinkTransaction: (tx: Transaction) => void;
  onSubmitNewBill: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const ItemBillPanel: React.FC<ItemBillPanelProps> = ({
  isSub,
  billRole,
  onChangeBillRole,
  billSource,
  onChangeBillSource,
  searchBillQuery,
  onChangeSearchBillQuery,
  candidateExpenses,
  candidateIncomeTxs,
  accounts,
  hostCategories,
  billPriceYuan,
  onChangeBillPriceYuan,
  billAccountId,
  onChangeBillAccountId,
  billDate,
  onChangeBillDate,
  isBillDateOpen,
  onOpenBillDate,
  billNote,
  onChangeBillNote,
  isSubmittingBill,
  onLinkTransaction,
  onSubmitNewBill,
  onClose,
}) => {
  const isProfitRole = !isSub && billRole === 'profit';
  const activeCandidates = isProfitRole ? candidateIncomeTxs : candidateExpenses;

  return (
    <div className="paper-card space-y-3 rounded-(--radius-md) border border-(--rule-strong) bg-(--paper-sheet) p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-(--ink-solid)">
          {isSub ? '续费记录' : '关联账单'}
        </div>
        {!isSub && (
          <SegToggle
            options={[
              { value: 'maintenance', label: '支出' },
              { value: 'profit', label: '收益' },
            ]}
            value={billRole}
            onChange={(val) => {
              onChangeBillRole(val as 'maintenance' | 'profit');
              onChangeSearchBillQuery('');
            }}
            size="sm"
            fullWidth={false}
          />
        )}
      </div>

      <SegToggle
        options={[
          { value: 'existing', label: '选已有账单' },
          { value: 'new', label: isSub ? '记新续费' : '记新账单' },
        ]}
        value={billSource}
        onChange={(val) => onChangeBillSource(val as 'existing' | 'new')}
        size="sm"
        fullWidth={true}
      />

      {billSource === 'existing' ? (
        <div className="space-y-2">
          <PaperInput
            size="sm"
            value={searchBillQuery}
            onChange={(e) => onChangeSearchBillQuery(e.target.value)}
            placeholder="搜索备注、分类、账户、金额..."
            leftIcon={<Search className="size-3.5 text-(--ink-tertiary)" />}
            clearable={Boolean(searchBillQuery)}
            onClear={() => onChangeSearchBillQuery('')}
          />

          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
            {activeCandidates.length === 0 ? (
              <div className="py-6 text-center font-mono text-xs text-(--ink-tertiary)">
                {searchBillQuery ? '未找到相关账单' : '暂无可选账单'}
              </div>
            ) : (
              activeCandidates.map((tx) => {
                const cat = hostCategories.find((c) => c.id === tx.categoryId);
                const acct = accounts.find((a) => a.id === tx.accountId);
                const CatIcon = getCategoryIcon(cat?.icon || 'squares-four');
                const isInc = tx.type === 'income';
                return (
                  <div
                    key={tx.id}
                    onClick={() => onLinkTransaction(tx)}
                    className="flex cursor-pointer items-center justify-between rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken)/40 p-2.5 transition-colors hover:border-(--border-strong) hover:bg-(--paper-hover)"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-(--radius-xs) bg-(--paper-sheet) text-(--ink-primary)">
                        <CatIcon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-(--ink-solid)">
                          {tx.note || cat?.name || (isInc ? '收入' : '支出')}
                        </div>
                        <div className="font-mono text-[10px] text-(--ink-tertiary)">
                          {tx.date} · {acct?.name || '账户'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 font-mono text-xs font-bold tabular-nums',
                        isInc ? 'text-(--color-income)' : 'text-(--ink-solid)'
                      )}
                    >
                      {isInc ? `+¥${centsToYuan(tx.amount)}` : `-¥${centsToYuan(tx.amount)}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-(--ink-tertiary)">
            <span>
              {searchBillQuery
                ? `搜索结果 ${activeCandidates.length} 笔`
                : `展示最近 30 笔未关联${isProfitRole ? '收入' : '支出'}`}
            </span>
            <PaperButton variant="secondary" size="xs" onClick={onClose}>
              关闭
            </PaperButton>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmitNewBill} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                {isProfitRole ? '收益金额' : '支出金额'}
              </label>
              <AmountInput
                size="sm"
                value={billPriceYuan}
                onChange={onChangeBillPriceYuan}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                {isProfitRole ? '入账账户' : '支付账户'}
              </label>
              <PaperSelect
                size="sm"
                value={billAccountId}
                onChange={(e) => onChangeBillAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </PaperSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                记账日期
              </label>
              <PaperButton
                variant="sunken"
                size="sm"
                fullWidth
                onClick={() => onOpenBillDate(true)}
                className="justify-start gap-2 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
                leftIcon={<CalendarBlank className="size-3 shrink-0 text-(--ink-tertiary)" />}
              >
                <span>{billDate || '选择日期'}</span>
              </PaperButton>
              <PaperDatePickerModal
                isOpen={isBillDateOpen}
                onClose={() => onOpenBillDate(false)}
                mode="date"
                value={billDate}
                onChange={onChangeBillDate}
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                备注
              </label>
              <PaperInput
                size="sm"
                type="text"
                value={billNote}
                onChange={(e) => onChangeBillNote(e.target.value)}
                placeholder={isProfitRole ? '输入收益备注' : '输入支出备注'}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
            <PaperButton variant="secondary" size="compact" onClick={onClose}>
              取消
            </PaperButton>
            <PaperButton
              variant={isProfitRole ? 'income' : 'primary'}
              size="compact"
              type="submit"
              disabled={isSubmittingBill}
            >
              确认记录
            </PaperButton>
          </div>
        </form>
      )}
    </div>
  );
};
