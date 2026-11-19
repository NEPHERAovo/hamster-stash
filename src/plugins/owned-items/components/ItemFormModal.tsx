import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import {
  useHostAccounts,
  useHostTransactionActions,
  yuanToCents,
  getCategoryIcon,
  toast,
  cn,
} from '../../../plugin-sdk';
import type { Item, ItemStatus } from '../types';
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

export const ItemFormModal: React.FC<ItemFormModalProps> = ({ onClose, params }) => {
  const editingItem = params?.item;
  const accounts = useHostAccounts();
  const { recordTransaction } = useHostTransactionActions();
  const { createItem, updateItem } = usePluginItemStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [buyDate, setBuyDate] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<ItemStatus>('using');

  const [costYuan, setCostYuan] = useState('');
  const [selectedAcctId, setSelectedAcctId] = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setIcon(editingItem.icon || 'box');
      setBuyDate(editingItem.buyDate);
      setNote(editingItem.note || '');
      setStatus(editingItem.status);
      setCostYuan('');
      setSelectedAcctId('');
      setIsHistorical(false);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setName('');
      setIcon('box');
      setBuyDate(today);
      setNote('');
      setStatus('using');
      setCostYuan('');
      setSelectedAcctId(accounts[0]?.id || '');
      setIsHistorical(false);
    }
  }, [editingItem, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入物品名称');
      return;
    }
    if (!buyDate) {
      toast.error('请选择购入日期');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          name: name.trim(),
          icon,
          buyDate,
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
          status,
          buyDate,
          note: note.trim() || undefined,
        });

        if (hasCost && selectedAcctId) {
          await recordTransaction({
            type: 'expense',
            amount: yuanToCents(costNum),
            accountId: selectedAcctId,
            categoryId: 'cat_shop',
            date: buyDate,
            note: `购入物品: ${name.trim()}`,
            ext: {
              'owned-items': {
                itemId: created.id,
                itemRole: 'buy',
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
        className="w-full max-w-[430px] bg-(--paper-sheet) transaction-sheet rounded-t-[2px] shadow-[0_-6px_22px_rgba(0,0,0,0.09)] border-t border-(--rule-hairline) flex flex-col sheet-slide-up relative overflow-visible paper-sawtooth-top"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="washi-tape absolute -top-3 left-1/2 -translate-x-1/2 z-30 shadow-xs" />

        <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-dashed border-(--rule-hairline)">
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-lg font-bold text-(--ink-solid)">
              <span className="paper-title inline">{editingItem ? 'Edit Item' : 'New Item'}</span>
              <span className="modern-title hidden">{editingItem ? '编辑物品' : '新建物品'}</span>
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
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
              物品名称
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入物品名称"
                className="flex-1 bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-sm font-semibold text-(--ink-solid) outline-none focus:border-(--ink-primary)"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1.5">
              物品图标
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {POPULAR_ITEM_ICONS.map((ic) => {
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
                购入日期
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
                物品状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer"
              >
                <option value="using">在用</option>
                <option value="idle">闲置</option>
                <option value="sold">已售出</option>
                <option value="scrapped">已报废</option>
              </select>
            </div>
          </div>

          {!editingItem && (
            <div className="pt-2 border-t border-dashed border-(--rule-hairline) space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-(--ink-tertiary) mb-1">
                    购入金额
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
                  <span>录入历史旧物（仅建购入凭证流水，不扣除账户当前余额）</span>
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

          <div className="pt-2 flex items-center justify-end gap-2">
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
              <span>保存物品</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
