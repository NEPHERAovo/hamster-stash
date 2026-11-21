import React, { useState, useEffect } from 'react';
import { X, Check } from '@phosphor-icons/react';
import {
  useHostAccounts,
  useHostTransactionActions,
  yuanToCents,
  centsToYuan,
  getCategoryIcon,
  toast,
  cn,
  SegToggle,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(kind === 'subscription' ? '请输入订阅服务名称' : '请输入物品名称');
      return;
    }
    if (!buyDate) {
      toast.error(kind === 'subscription' ? '请选择订阅起始日期' : '请选择购入日期');
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
        className="fixed inset-0 bg-stone-900/25 backdrop-blur-[2px] modal-backdrop-fade will-change-[opacity]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="w-full max-w-[430px] bg-(--paper-sheet) transaction-sheet rounded-t-[2px] shadow-[0_-6px_22px_rgba(0,0,0,0.09)] border-t border-(--rule-hairline) flex flex-col sheet-slide-up relative overflow-visible paper-sawtooth-top max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="washi-tape absolute -top-3 left-1/2 -translate-x-1/2 z-30 shadow-xs" />

        <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-dashed border-(--rule-hairline)">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-lg font-bold text-(--ink-solid)">
              <span className="paper-title inline">{editingItem ? 'Edit Holding' : 'New Holding'}</span>
              <span className="modern-title hidden">{editingItem ? '编辑持有' : '新建持有'}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-(--ink-tertiary) hover:text-(--ink-primary) rounded-(--btn-radius) cursor-pointer"
          >
            <X className="w-4 h-4 stroke-2" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1.5">
              持有属性
            </label>
            <SegToggle
              options={[
                { value: 'physical', label: '实体物品' },
                { value: 'subscription', label: '数字订阅' },
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
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
              {kind === 'subscription' ? '订阅服务名称' : '物品名称'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'subscription' ? '例如：ChatGPT Plus、iCloud+、宽带' : '例如：MacBook、咖啡机、公路车'}
              className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-sm font-semibold text-(--ink-solid) outline-none focus:border-(--ink-primary)"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1.5">
              图标标识
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {currentIconChoices.map((ic) => {
                const IconComp = getCategoryIcon(ic);
                const isSelected = icon === ic;
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'h-8 rounded-(--radius-sm) flex items-center justify-center transition-all cursor-pointer border',
                      isSelected
                        ? 'bg-(--color-accent) text-white font-bold shadow-xs border-(--color-accent) -rotate-1'
                        : 'text-(--ink-tertiary) hover:text-(--ink-secondary) hover:bg-(--paper-sunken)/40 border-transparent'
                    )}
                  >
                    <IconComp className="w-4 h-4 stroke-[1.8]" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                {kind === 'subscription' ? '订阅起始日' : '购入日期'}
              </label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                {kind === 'subscription' ? '订阅状态' : '物品状态'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer"
              >
                <option value="using">{kind === 'subscription' ? '在订' : '在用'}</option>
                <option value="idle">{kind === 'subscription' ? '暂停' : '闲置'}</option>
                <option value="sold">{kind === 'subscription' ? '已退订' : '已售出'}</option>
                {kind === 'physical' && <option value="scrapped">已报废</option>}
              </select>
            </div>
          </div>

          {kind === 'subscription' && (
            <div className="pt-2 border-t border-dashed border-(--rule-hairline) space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                    续费周期
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as SubscriptionCycle)}
                    className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer"
                  >
                    <option value="monthly">按月 (Monthly)</option>
                    <option value="yearly">按年 (Yearly)</option>
                    <option value="quarterly">按季 (Quarterly)</option>
                    <option value="weekly">按周 (Weekly)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                    单期续费 (元)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={renewalAmountYuan}
                    onChange={(e) => setRenewalAmountYuan(e.target.value)}
                    placeholder="例如 140.00"
                    className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                  下次续费日 (可选)
                </label>
                <input
                  type="date"
                  value={nextRenewalDate}
                  onChange={(e) => setNextRenewalDate(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
                />
              </div>
            </div>
          )}

          {!editingItem && (
            <div className="pt-2 border-t border-dashed border-(--rule-hairline) space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                    {kind === 'subscription' ? '首期支出金额' : '购入金额'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costYuan}
                    onChange={(e) => setCostYuan(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                    支出账户
                  </label>
                  <select
                    value={selectedAcctId}
                    onChange={(e) => setSelectedAcctId(e.target.value)}
                    disabled={!costYuan || parseFloat(costYuan) <= 0}
                    className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer disabled:opacity-40"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {costYuan && parseFloat(costYuan) > 0 && (
                <label className="flex items-center gap-2 text-[11px] text-(--ink-secondary) cursor-pointer select-none pt-0.5">
                  <input
                    type="checkbox"
                    checked={isHistorical}
                    onChange={(e) => setIsHistorical(e.target.checked)}
                    className="rounded-xs text-(--ink-solid) focus:ring-0 cursor-pointer"
                  />
                  <span>录入历史记录（仅建流水，不扣除账户当前余额）</span>
                </label>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
              备注
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加备注"
              className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-secondary) outline-none focus:border-(--ink-primary)"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-(--btn-radius) text-xs font-mono text-(--ink-secondary) hover:text-(--ink-primary) cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-(--btn-radius) text-xs font-mono font-semibold bg-(--btn-primary-bg) text-(--btn-primary-fg) hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5 stroke-2" />
              <span>保存持有</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
