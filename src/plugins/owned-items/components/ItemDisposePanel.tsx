import React from 'react';
import {
  centsToYuan,
  PaperCard,
  PaperButton,
  PaperInput,
  PaperSelect,
  AmountInput,
  SegToggle,
  PaperDateField,
  type Account,
  type Transaction,
} from '../../../plugin-sdk';

export interface ItemDisposePanelProps {
  dispositionMode: 'sold' | 'idle' | 'gifted' | 'scrapped';
  onChangeDispositionMode: (mode: 'sold' | 'idle' | 'gifted' | 'scrapped') => void;
  sellSource: 'new' | 'existing';
  onChangeSellSource: (source: 'new' | 'existing') => void;
  candidateIncomeTxs: Transaction[];
  selectedIncomeTxId: string;
  onSelectIncomeTxId: (id: string) => void;
  sellPriceYuan: string;
  onChangeSellPriceYuan: (val: string) => void;
  sellAccountId: string;
  onChangeSellAccountId: (id: string) => void;
  accounts: Account[];
  disposeDate: string;
  onChangeDisposeDate: (date: string) => void;
  disposeNote: string;
  onChangeDisposeNote: (note: string) => void;
  isSubmittingDispose: boolean;
  onSubmit: (e: React.SyntheticEvent) => void;
  onClose: () => void;
}

export const ItemDisposePanel: React.FC<ItemDisposePanelProps> = ({
  dispositionMode,
  onChangeDispositionMode,
  sellSource,
  onChangeSellSource,
  candidateIncomeTxs,
  selectedIncomeTxId,
  onSelectIncomeTxId,
  sellPriceYuan,
  onChangeSellPriceYuan,
  sellAccountId,
  onChangeSellAccountId,
  accounts,
  disposeDate,
  onChangeDisposeDate,
  disposeNote,
  onChangeDisposeNote,
  isSubmittingDispose,
  onSubmit,
  onClose,
}) => {
  const dateLabelMap: Record<'sold' | 'idle' | 'gifted' | 'scrapped', string> = {
    sold: '售出日期',
    idle: '闲置日期',
    gifted: '赠送日期',
    scrapped: '报废日期',
  };

  const notePlaceholderMap: Record<'sold' | 'idle' | 'gifted' | 'scrapped', string> = {
    sold: '输入售出说明',
    idle: '输入闲置原因',
    gifted: '如：赠予好友',
    scrapped: '如：损坏丢弃',
  };

  return (
    <PaperCard variant="elevated" rounded="md" padding="none" className="p-3.5">
      <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-(--ink-solid)">处置</div>
        <SegToggle
          options={[
            { value: 'sold', label: '售出' },
            { value: 'idle', label: '闲置' },
            { value: 'gifted', label: '赠送' },
            { value: 'scrapped', label: '报废' },
          ]}
          value={dispositionMode}
          onChange={(val) => onChangeDispositionMode(val as 'sold' | 'idle' | 'gifted' | 'scrapped')}
          size="sm"
          fullWidth={false}
        />
      </div>

      {dispositionMode === 'sold' && (
        <SegToggle
          options={[
            { value: 'new', label: '新建收入' },
            { value: 'existing', label: '已有收入' },
          ]}
          value={sellSource}
          onChange={(val) => onChangeSellSource(val as 'new' | 'existing')}
          size="sm"
          fullWidth={true}
        />
      )}

      {dispositionMode === 'sold' && sellSource === 'existing' ? (
        <div className="max-h-44 space-y-1 divide-y divide-dashed divide-(--rule-hairline)/60 overflow-y-auto">
          {candidateIncomeTxs.length === 0 ? (
            <div className="py-4 text-center font-mono text-xs text-(--ink-tertiary)">
              暂无可关联的收入记录
            </div>
          ) : (
            candidateIncomeTxs.map((tx) => {
              const isSelected = selectedIncomeTxId === tx.id;
              return (
                <PaperButton
                  key={tx.id}
                  type="button"
                  variant={isSelected ? 'sunken' : 'ghost'}
                  size="compact"
                  fullWidth
                  onClick={() => onSelectIncomeTxId(tx.id)}
                  className="h-auto justify-between px-2.5 py-2 text-left font-normal"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="truncate text-xs font-medium text-(--ink-primary)">
                      {tx.note || '收入'}
                    </div>
                    <div className="font-mono text-[10px] text-(--ink-tertiary)">
                      {tx.date}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-(--color-income) tabular-nums">
                    +¥{centsToYuan(tx.amount)}
                  </span>
                </PaperButton>
              );
            })
          )}
        </div>
      ) : (
        <>
          {dispositionMode === 'sold' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                  售出金额
                </label>
                <AmountInput
                  size="sm"
                  value={sellPriceYuan}
                  onChange={onChangeSellPriceYuan}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                  入账账户
                </label>
                <PaperSelect
                  size="sm"
                  value={sellAccountId}
                  onChange={(e) => onChangeSellAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </PaperSelect>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="mb-1 paper-field-label">
                {dateLabelMap[dispositionMode]}
              </label>
              <PaperDateField
                value={disposeDate}
                onChange={onChangeDisposeDate}
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                备注
              </label>
              <PaperInput
                size="sm"
                type="text"
                value={disposeNote}
                onChange={(e) => onChangeDisposeNote(e.target.value)}
                placeholder={notePlaceholderMap[dispositionMode]}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
        <PaperButton variant="secondary" size="compact" onClick={onClose}>
          取消
        </PaperButton>
        <PaperButton
          variant={dispositionMode === 'sold' ? 'income' : 'primary'}
          size="compact"
          type="submit"
          disabled={isSubmittingDispose}
        >
          确认
        </PaperButton>
      </div>
      </form>
    </PaperCard>
  );
};
