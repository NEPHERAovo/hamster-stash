import React, { useState, useEffect, useMemo } from 'react';
import { CheckIcon as Check, CalendarBlankIcon as CalendarBlank, DotsThreeIcon as DotsThree, MagnifyingGlassIcon as Search } from '@phosphor-icons/react';
import {
  useHostAccounts,
  useHostCategories,
  useHostTransactions,
  useHostTransactionActions,
  yuanToCents,
  centsToYuan,
  getCategoryIcon,
  toast,
  dayjs,
  todayDate,
  cn,
  SegToggle,
  PaperButton,
  PaperIconButton,
  PaperInput,
  PaperSelect,
  PaperModal,
  AmountInput,
  PaperDatePickerModal,
  PaperIconPickerModal,
} from '../../../plugin-sdk';
import { getOwnedItemExt, type Item, type ItemStatus, type ItemKind, type SubscriptionCycle } from '../types';
import { usePluginItemStore } from '../store/usePluginItemStore';

export interface ItemFormModalProps {
  onClose: () => void;
  params?: {
    item?: Item | null;
    prefillName?: string;
    prefillCostYuan?: string;
    prefillKind?: ItemKind;
    prefillBuyDate?: string;
  };
}

function calculateNextRenewalDate(startDate: string, cycle: SubscriptionCycle): string {
  if (!startDate) return '';
  const d = dayjs(startDate);
  if (!d.isValid()) return '';
  switch (cycle) {
    case 'yearly':
      return d.add(1, 'year').format('YYYY-MM-DD');
    case 'quarterly':
      return d.add(3, 'month').format('YYYY-MM-DD');
    case 'weekly':
      return d.add(1, 'week').format('YYYY-MM-DD');
    case 'monthly':
    default:
      return d.add(1, 'month').format('YYYY-MM-DD');
  }
}

const POPULAR_ITEM_ICONS = [
  'box',
  'smartphone',
  'laptop',
  'camera',
  'headphones',
  'gamepad',
  'watch',
  'tv',
  'car',
  'bike',
  'armchair',
  'gift',
  'shirt',
  'bag',
  'wrench',
];

const POPULAR_SUB_ICONS = [
  'credit-card',
  'receipt',
  'sparkles',
  'clapperboard',
  'music',
  'cloud',
  'shield-check',
  'globe',
  'book-open',
  'graduation-cap',
  'wrench',
  'tv',
  'gamepad',
  'lightning',
  'smartphone',
];

export const ItemFormModal: React.FC<ItemFormModalProps> = ({ onClose, params }) => {
  const editingItem = params?.item;
  const accounts = useHostAccounts();
  const categories = useHostCategories();
  const transactions = useHostTransactions();
  const { recordTransaction, updateTransaction } = useHostTransactionActions();
  const { createItem, updateItem } = usePluginItemStore();

  const [kind, setKind] = useState<ItemKind>('physical');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [buyDate, setBuyDate] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<ItemStatus>('using');

  const [billingCycle, setBillingCycle] = useState<SubscriptionCycle>('monthly');
  const [renewalAmountYuan, setRenewalAmountYuan] = useState('');
  const [nextRenewalDate, setNextRenewalDate] = useState('');
  const [isBuyDateOpen, setIsBuyDateOpen] = useState(false);
  const [isNextRenewalDateOpen, setIsNextRenewalDateOpen] = useState(false);

  const [costYuan, setCostYuan] = useState('');
  const [selectedAcctId, setSelectedAcctId] = useState('');
  const [expenseSource, setExpenseSource] = useState<'new' | 'existing'>('new');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);

  const candidateExpenseTxs = useMemo(() => {
    const q = billSearchQuery.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (tx.type !== 'expense') return false;
        if (getOwnedItemExt(tx.ext)?.itemId) return false;
        if (!q) return true;
        const cat = categories.find((c) => c.id === tx.categoryId);
        const acct = accounts.find((a) => a.id === tx.accountId);
        const haystack = [tx.note || '', cat?.name || '', acct?.name || '', centsToYuan(tx.amount), tx.date]
          .join(' ')
          .toLowerCase();
        return q.split(/\s+/).every((part) => haystack.includes(part));
      })
      .slice(0, 30);
  }, [transactions, categories, accounts, billSearchQuery]);

  useEffect(() => {
    if (editingItem) {
      setKind(editingItem.kind || 'physical');
      setName(editingItem.name);
      setIcon(editingItem.icon || (editingItem.kind === 'subscription' ? 'credit-card' : 'box'));
      setBuyDate(editingItem.buyDate);
      setNote(editingItem.note || '');
      setStatus(editingItem.status);
      setBillingCycle(editingItem.billingCycle || 'monthly');
      setRenewalAmountYuan(editingItem.renewalAmountCents ? centsToYuan(editingItem.renewalAmountCents) : '');
      setNextRenewalDate(editingItem.nextRenewalDate || '');
      setCostYuan('');
      setSelectedAcctId('');
    } else {
      const today = todayDate();
      const initialKind = params?.prefillKind || 'physical';
      const initialCost = params?.prefillCostYuan || '';
      const initialDate = params?.prefillBuyDate || today;
      setKind(initialKind);
      setName(params?.prefillName || '');
      setIcon(initialKind === 'subscription' ? 'credit-card' : 'box');
      setBuyDate(initialDate);
      setNote('');
      setStatus('using');
      setBillingCycle('monthly');
      setCostYuan(initialCost);
      setRenewalAmountYuan(initialCost);
      setNextRenewalDate(calculateNextRenewalDate(initialDate, 'monthly'));
      setSelectedAcctId(accounts[0]?.id || '');
      setExpenseSource('new');
      setBillSearchQuery('');
      setSelectedExpenseId('');
    }
  }, [editingItem, accounts, params]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!name.trim()) {
      toast.error(kind === 'subscription' ? '请输入服务名称' : '请输入物品名称');
      return;
    }
    if (!buyDate) {
      toast.error(kind === 'subscription' ? '请选择起始日期' : '请选择购入日期');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const renewalAmountCents = renewalAmountYuan && !isNaN(parseFloat(renewalAmountYuan))
        ? yuanToCents(parseFloat(renewalAmountYuan))
        : undefined;

      if (editingItem) {
        await updateItem(editingItem.id, {
          name: name.trim(),
          icon,
          kind,
          buyDate,
          billingCycle: kind === 'subscription' ? billingCycle : undefined,
          renewalAmountCents: kind === 'subscription' ? renewalAmountCents : undefined,
          nextRenewalDate: kind === 'subscription' && nextRenewalDate ? nextRenewalDate : undefined,
          note: note.trim() || undefined,
          status,
        });
        onClose();
      } else {
        const linkedTx =
          expenseSource === 'existing'
            ? transactions.find((t) => t.id === selectedExpenseId)
            : undefined;
        if (expenseSource === 'existing' && !linkedTx) {
          toast.error('请选择要关联的已有消费账单');
          return;
        }

        const costNum = parseFloat(costYuan);
        const hasCost = expenseSource === 'new' && !isNaN(costNum) && costNum > 0;

        const created = await createItem({
          name: name.trim(),
          icon,
          kind,
          status,
          buyDate: linkedTx ? linkedTx.date : buyDate,
          billingCycle: kind === 'subscription' ? billingCycle : undefined,
          renewalAmountCents: kind === 'subscription' ? renewalAmountCents : undefined,
          nextRenewalDate: kind === 'subscription' && nextRenewalDate ? nextRenewalDate : undefined,
          note: note.trim() || undefined,
        });

        if (linkedTx) {
          await updateTransaction(linkedTx.id, {
            ext: {
              ...(linkedTx.ext || {}),
              'owned-items': {
                itemId: created.id,
                itemRole: 'buy',
                kind,
              },
            },
          });
        } else if (hasCost && selectedAcctId) {
          await recordTransaction({
            type: 'expense',
            amount: yuanToCents(costNum),
            accountId: selectedAcctId,
            categoryId: kind === 'subscription' ? 'cat_digital' : 'cat_shop',
            date: buyDate,
            note: kind === 'subscription' ? `订阅支出: ${name.trim()}` : `购入物品: ${name.trim()}`,
            ext: {
              'owned-items': {
                itemId: created.id,
                itemRole: 'buy',
                kind,
              },
            },
          });
        }

        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const baseIcons = kind === 'subscription' ? POPULAR_SUB_ICONS : POPULAR_ITEM_ICONS;
  const currentIconChoices = useMemo(() => {
    if (icon && !baseIcons.includes(icon)) {
      return [icon, ...baseIcons.slice(0, 14)];
    }
    return baseIcons.slice(0, 15);
  }, [baseIcons, icon]);

  const getModalTitle = () => {
    if (editingItem) {
      if (editingItem.kind === 'subscription') return '编辑订阅';
      return '编辑物品';
    }
    if (kind === 'subscription') return '新建订阅';
    return '新建物品';
  };

  return (
    <PaperModal
      isOpen={true}
      onClose={onClose}
      title={getModalTitle()}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 p-4 text-xs">
        <div>
          <label className="mb-1.5 block font-mono text-[11px] text-(--ink-tertiary)">
            类型
          </label>
          <SegToggle
            options={[
              { value: 'physical', label: '物品' },
              { value: 'subscription', label: '订阅' },
            ]}
            value={kind}
            onChange={(nextKind) => {
              setKind(nextKind);
              if (!editingItem) {
                setIcon(nextKind === 'subscription' ? 'credit-card' : 'box');
                if (nextKind === 'subscription') {
                  if (!nextRenewalDate) {
                    setNextRenewalDate(calculateNextRenewalDate(buyDate, billingCycle));
                  }
                  if (!renewalAmountYuan && costYuan) {
                    setRenewalAmountYuan(costYuan);
                  }
                }
              }
            }}
            size="sm"
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
            {kind === 'subscription' ? '服务名称' : '物品名称'}
          </label>
          <PaperInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'subscription' ? '输入服务名称' : '输入物品名称'}
          />
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[11px] text-(--ink-tertiary)">
            图标
          </label>
          <div className="grid grid-cols-8 gap-1.5">
            {currentIconChoices.map((ic) => {
              const IconComp = getCategoryIcon(ic);
              const isSelected = icon === ic;
              return (
                <PaperIconButton
                  key={ic}
                  icon={IconComp}
                  size="md"
                  variant={isSelected ? 'primary' : 'sunken'}
                  className={cn(
                    'flex aspect-square h-auto w-full items-center justify-center transition-all',
                    isSelected && 'ring-1 ring-(--color-income)'
                  )}
                  onClick={() => setIcon(ic)}
                  title={ic}
                  aria-label={ic}
                />
              );
            })}
            <PaperIconButton
              icon={DotsThree}
              size="md"
              variant="sunken"
              className="flex aspect-square h-auto w-full items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary)"
              onClick={() => setIsIconPickerOpen(true)}
              title="更多图标"
              aria-label="更多图标"
            />
          </div>
          <PaperIconPickerModal
            isOpen={isIconPickerOpen}
            onClose={() => setIsIconPickerOpen(false)}
            selectedIcon={icon}
            onSelect={(newIcon) => setIcon(newIcon)}
          />
        </div>

        {!editingItem && (
          <div className="space-y-2.5 border-t border-dashed border-(--rule-hairline) pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-(--ink-tertiary)">
                {kind === 'subscription' ? '首次扣费' : '购买账单'}
              </span>
              <SegToggle
                options={[
                  { value: 'new', label: '新建消费' },
                  { value: 'existing', label: '关联已有账单' },
                ]}
                value={expenseSource}
                onChange={(val) => setExpenseSource(val as 'new' | 'existing')}
                size="xs"
                fullWidth={false}
              />
            </div>

            {expenseSource === 'new' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    {kind === 'subscription' ? '首次支出' : '购入金额'}
                  </label>
                  <AmountInput
                    size="sm"
                    value={costYuan}
                    onChange={(val) => {
                      setCostYuan(val);
                      if (!editingItem && (renewalAmountYuan === '' || renewalAmountYuan === costYuan)) {
                        setRenewalAmountYuan(val);
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    支出账户
                  </label>
                  <PaperSelect
                    size="sm"
                    value={selectedAcctId}
                    onChange={(e) => setSelectedAcctId(e.target.value)}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </PaperSelect>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <PaperInput
                  size="sm"
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder="搜索备注、分类、账户、金额..."
                  leftIcon={<Search className="size-3.5 text-(--ink-tertiary)" />}
                  clearable={Boolean(billSearchQuery)}
                  onClear={() => setBillSearchQuery('')}
                />

                <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                  {candidateExpenseTxs.length === 0 ? (
                    <div className="py-4 text-center font-mono text-xs text-(--ink-tertiary)">
                      暂无未关联物品的消费记录
                    </div>
                  ) : (
                    candidateExpenseTxs.map((tx) => {
                      const cat = categories.find((c) => c.id === tx.categoryId);
                      const acct = accounts.find((a) => a.id === tx.accountId);
                      const isSelected = selectedExpenseId === tx.id;
                      return (
                        <PaperButton
                          key={tx.id}
                          type="button"
                          variant={isSelected ? 'sunken' : 'ghost'}
                          size="compact"
                          fullWidth
                          onClick={() => {
                            setSelectedExpenseId(tx.id);
                            setBuyDate(tx.date);
                            if (!name.trim()) {
                              setName(tx.note || cat?.name || '');
                            }
                            if (kind === 'subscription') {
                              setRenewalAmountYuan(centsToYuan(tx.amount));
                              setNextRenewalDate(calculateNextRenewalDate(tx.date, billingCycle));
                            }
                          }}
                          className="h-auto justify-between px-2.5 py-2 text-left font-normal"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="truncate text-xs font-medium text-(--ink-primary)">
                              {tx.note || cat?.name || '支出'}
                            </div>
                            <div className="font-mono text-[10px] text-(--ink-tertiary)">
                              {tx.date} · {acct?.name || '账户'}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-semibold text-(--ink-solid) tabular-nums">
                            -¥{centsToYuan(tx.amount)}
                          </span>
                        </PaperButton>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {kind === 'subscription' ? (
          <div className="space-y-2.5 border-t border-dashed border-(--rule-hairline) pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                  续费周期
                </label>
                <PaperSelect
                  size="sm"
                  value={billingCycle}
                  onChange={(e) => {
                    const nextCycle = e.target.value as SubscriptionCycle;
                    setBillingCycle(nextCycle);
                    if (!editingItem) {
                      setNextRenewalDate(calculateNextRenewalDate(buyDate, nextCycle));
                    }
                  }}
                >
                  <option value="monthly">按月</option>
                  <option value="yearly">按年</option>
                  <option value="quarterly">按季</option>
                  <option value="weekly">按周</option>
                </PaperSelect>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                  每期金额
                </label>
                <AmountInput
                  size="sm"
                  value={renewalAmountYuan}
                  onChange={setRenewalAmountYuan}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                  起始日期
                </label>
                <PaperButton
                  variant="sunken"
                  size="sm"
                  fullWidth
                  onClick={() => setIsBuyDateOpen(true)}
                  className="justify-start gap-1.5 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
                  leftIcon={<CalendarBlank className="size-3 shrink-0 text-(--ink-tertiary)" />}
                >
                  <span className="truncate">{buyDate || '选择日期'}</span>
                </PaperButton>
                <PaperDatePickerModal
                  isOpen={isBuyDateOpen}
                  onClose={() => setIsBuyDateOpen(false)}
                  mode="date"
                  value={buyDate}
                  onChange={(val) => {
                    setBuyDate(val);
                    if (!editingItem && kind === 'subscription') {
                      setNextRenewalDate(calculateNextRenewalDate(val, billingCycle));
                    }
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                  下次续费日
                </label>
                <PaperButton
                  variant="sunken"
                  size="sm"
                  fullWidth
                  onClick={() => setIsNextRenewalDateOpen(true)}
                  className="justify-start gap-1.5 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
                  leftIcon={<CalendarBlank className="size-3 shrink-0 text-(--ink-tertiary)" />}
                >
                  <span className="truncate">{nextRenewalDate || '选择日期'}</span>
                </PaperButton>
                <PaperDatePickerModal
                  isOpen={isNextRenewalDateOpen}
                  onClose={() => setIsNextRenewalDateOpen(false)}
                  mode="date"
                  value={nextRenewalDate}
                  onChange={(val) => setNextRenewalDate(val)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-dashed border-(--rule-hairline) pt-2">
            <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
              购入日期
            </label>
            <PaperButton
              variant="sunken"
              size="sm"
              fullWidth
              onClick={() => setIsBuyDateOpen(true)}
              className="justify-start gap-2 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
              leftIcon={<CalendarBlank className="size-3.5 shrink-0 text-(--ink-tertiary)" />}
            >
              <span>{buyDate || '选择日期'}</span>
            </PaperButton>
            <PaperDatePickerModal
              isOpen={isBuyDateOpen}
              onClose={() => setIsBuyDateOpen(false)}
              mode="date"
              value={buyDate}
              onChange={(val) => setBuyDate(val)}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
            备注
          </label>
          <PaperInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注"
            size="sm"
          />
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-3 -mb-4 flex items-center gap-2 border-t border-(--rule-hairline) bg-(--paper-sheet) px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom))] shadow-xs">
          <PaperButton
            type="button"
            variant="sunken"
            className="flex-1"
            onClick={onClose}
          >
            取消
          </PaperButton>
          <PaperButton
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isSubmitting}
            loading={isSubmitting}
            leftIcon={<Check className="size-4 stroke-2" />}
          >
            {editingItem ? '保存修改' : '确认添加'}
          </PaperButton>
        </div>
      </form>
    </PaperModal>
  );
};

export default ItemFormModal;
