import React, { useState, useEffect } from 'react';
import { XIcon as X, CheckIcon as Check } from '@phosphor-icons/react';
import {
  useHostAccounts,
  useHostTransactionActions,
  yuanToCents,
  centsToYuan,
  getCategoryIcon,
  toast,
  SegToggle,
  PaperButton,
  PaperIconButton,
  PaperInput,
  PaperSelect,
  PaperSwitch,
} from '../../../plugin-sdk';
import type { Item, ItemStatus, ItemKind, SubscriptionCycle } from '../types';
import { usePluginItemStore } from '../store/usePluginItemStore';

export interface ItemFormModalProps {
  onClose: () => void;
  params?: {
    item?: Item | null;
  };
}

const POPULAR_ITEM_ICONS = [
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
  'box',
  'package',
];

const POPULAR_SUB_ICONS = [
  'credit-card',
  'receipt',
  'sparkles',
  'clapperboard',
  'music-notes',
  'cloud',
  'shield-check',
  'globe',
  'book-open',
  'graduation-cap',
  'heart-pulse',
  'wrench',
];

export const ItemFormModal: React.FC<ItemFormModalProps> = ({ onClose, params }) => {
  const editingItem = params?.item;
  const accounts = useHostAccounts();
  const { recordTransaction } = useHostTransactionActions();
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

  const [costYuan, setCostYuan] = useState('');
  const [selectedAcctId, setSelectedAcctId] = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setIsHistorical(false);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setKind('physical');
      setName('');
      setIcon('box');
      setBuyDate(today);
      setNote('');
      setStatus('using');
      setBillingCycle('monthly');
      setRenewalAmountYuan('');
      setNextRenewalDate('');
      setCostYuan('');
      setSelectedAcctId(accounts[0]?.id || '');
      setIsHistorical(false);
    }
  }, [editingItem, accounts]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(kind === 'subscription' ? '请输入服务名称' : '请输入物品名称');
      return;
    }
    if (!buyDate) {
      toast.error(kind === 'subscription' ? '请选择起始日期' : '请选择购入日期');
      return;
    }

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
        const costNum = parseFloat(costYuan);
        const hasCost = !isNaN(costNum) && costNum > 0;

        const created = await createItem({
          name: name.trim(),
          icon,
          kind,
          status,
          buyDate,
          billingCycle: kind === 'subscription' ? billingCycle : undefined,
          renewalAmountCents: kind === 'subscription' ? renewalAmountCents : undefined,
          nextRenewalDate: kind === 'subscription' && nextRenewalDate ? nextRenewalDate : undefined,
          note: note.trim() || undefined,
        });

        if (hasCost && selectedAcctId) {
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
                skipBalanceDeduction: isHistorical,
              },
            },
          });
        }

        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentIconChoices = kind === 'subscription' ? POPULAR_SUB_ICONS : POPULAR_ITEM_ICONS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center select-none"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-backdrop-fade fixed inset-0 bg-stone-900/25 backdrop-blur-[2px] will-change-[opacity]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="transaction-sheet sheet-slide-up paper-sawtooth-top relative flex max-h-[90dvh] w-full max-w-[430px] flex-col overflow-visible overflow-y-auto rounded-t-[2px] border-t border-(--rule-hairline) bg-(--paper-sheet) shadow-[0_-6px_22px_rgba(0,0,0,0.09)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="washi-tape absolute -top-3 left-1/2 z-30 -translate-x-1/2 shadow-xs" />

        <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline) px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-lg font-bold text-(--ink-solid)">
              {editingItem ? '编辑' : '新建'}
            </span>
          </div>
          <PaperIconButton
            icon={X}
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="关闭"
          />
        </div>

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
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-(--ink-tertiary)">
              图标
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {currentIconChoices.map((ic) => {
                const IconComp = getCategoryIcon(ic);
                const isSelected = icon === ic;
                return (
                  <PaperIconButton
                    key={ic}
                    icon={IconComp}
                    size="md"
                    variant={isSelected ? 'primary' : 'sunken'}
                    onClick={() => setIcon(ic)}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
              {kind === 'subscription' ? '起始日期' : '购入日期'}
            </label>
            <PaperInput
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
            />
          </div>

          {kind === 'subscription' && (
            <div className="space-y-2.5 border-t border-dashed border-(--rule-hairline) pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    续费周期
                  </label>
                  <PaperSelect
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as SubscriptionCycle)}
                  >
                    <option value="monthly">按月</option>
                    <option value="yearly">按年</option>
                    <option value="quarterly">按季</option>
                    <option value="weekly">按周</option>
                  </PaperSelect>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    续费金额
                  </label>
                  <PaperInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={renewalAmountYuan}
                    onChange={(e) => setRenewalAmountYuan(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                  下次续费日
                </label>
                <PaperInput
                  type="date"
                  value={nextRenewalDate}
                  onChange={(e) => setNextRenewalDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {!editingItem && (
            <div className="space-y-2.5 border-t border-dashed border-(--rule-hairline) pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    {kind === 'subscription' ? '首次支出' : '购入金额'}
                  </label>
                  <PaperInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={costYuan}
                    onChange={(e) => setCostYuan(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[11px] text-(--ink-tertiary)">
                    支出账户
                  </label>
                  <PaperSelect
                    value={selectedAcctId}
                    onChange={(e) => setSelectedAcctId(e.target.value)}
                    disabled={!costYuan || parseFloat(costYuan) <= 0}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </PaperSelect>
                </div>
              </div>

              {costYuan && parseFloat(costYuan) > 0 && (
                <div className="flex items-center justify-between pt-0.5 select-none">
                  <span className="text-[11px] text-(--ink-secondary)">录入历史记录（仅建流水，不扣除当前余额）</span>
                  <PaperSwitch
                    checked={isHistorical}
                    onChange={(val) => setIsHistorical(val)}
                    aria-label="录入历史记录"
                  />
                </div>
              )}
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
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 pb-(--safe-bottom)">
            <PaperButton
              variant="secondary"
              size="compact"
              onClick={onClose}
            >
              取消
            </PaperButton>
            <PaperButton
              variant="primary"
              size="compact"
              type="submit"
              disabled={isSubmitting}
              leftIcon={<Check className="size-3.5 stroke-2" />}
            >
              {editingItem ? '保存修改' : '确认添加'}
            </PaperButton>
          </div>
        </form>
      </div>
    </div>
  );
};
