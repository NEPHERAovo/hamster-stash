import React, { useState, useMemo } from 'react';
import { CaretLeft as ChevronLeft, Plus, Trash as Trash2, PencilSimple as Edit2, Coins as DollarSign, Check, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';
import {
  useHostTransactions,
  useHostAccounts,
  useHostTransactionActions,
  usePluginNavigation,
  centsToYuan,
  yuanToCents,
  getCategoryIcon,
  toast,
  confirmAction,
  cn,
} from '../../../plugin-sdk';
import { type ItemStatus, getOwnedItemExt } from '../types';
import type { Transaction } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { computeItemMetrics } from '../domain/itemCalculator';

export interface ItemDetailSubPageProps {
  onClose: () => void;
  params?: {
    itemId?: string;
  };
}

export const ItemDetailSubPage: React.FC<ItemDetailSubPageProps> = ({ onClose, params }) => {
  const itemId = params?.itemId;
  const item = usePluginItemStore((s) => s.items.find((i) => i.id === itemId));
  const { deleteItem, changeStatus } = usePluginItemStore();
  const transactions = useHostTransactions();
  const accounts = useHostAccounts();
  const { recordTransaction } = useHostTransactionActions();
  const { openModal } = usePluginNavigation();

  const [isSellPanelOpen, setIsSellPanelOpen] = useState(false);
  const [sellPriceYuan, setSellPriceYuan] = useState('');
  const [sellAccountId, setSellAccountId] = useState(accounts[0]?.id || '');
  const [sellDate, setSellDate] = useState(new Date().toISOString().split('T')[0]);
  const [sellNote, setSellNote] = useState('');
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);

  const [isMaintPanelOpen, setIsMaintPanelOpen] = useState(false);
  const [maintPriceYuan, setMaintPriceYuan] = useState('');
  const [maintAccountId, setMaintAccountId] = useState(accounts[0]?.id || '');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0]);
  const [maintNote, setMaintNote] = useState('');
  const [isSubmittingMaint, setIsSubmittingMaint] = useState(false);

  const isSub = item?.kind === 'subscription';

  const itemTransactions = useMemo(() => {
    if (!item) return [];
    return transactions
      .filter((t) => getOwnedItemExt(t.ext)?.itemId === item.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, item]);

  const metrics = useMemo(() => {
    if (!item) return null;
    return computeItemMetrics(item, transactions);
  }, [item, transactions]);

  if (!item || !metrics) {
    return (
      <div className="p-8 text-center text-xs text-(--ink-tertiary) space-y-3">
        <p>未找到该项信息</p>
        <button
          type="button"
          onClick={onClose}
          className="text-(--ink-secondary) underline cursor-pointer"
        >
          返回清单
        </button>
      </div>
    );
  }

  const ItemIcon = getCategoryIcon(item.icon);

  const handleConfirmSell = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(sellPriceYuan);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('请输入有效的金额');
      return;
    }
    if (!sellAccountId) {
      toast.error('请选择入账账户');
      return;
    }

    setIsSubmittingSell(true);
    try {
      await recordTransaction({
        type: 'income',
        amount: yuanToCents(priceNum),
        accountId: sellAccountId,
        categoryId: 'cat_shop',
        date: sellDate,
        note: sellNote.trim() || `二手售出回血: ${item.name}`,
        ext: {
          'owned-items': {
            itemId: item.id,
            itemRole: 'sell',
          },
        },
      });

      await changeStatus(item.id, 'sold', sellDate);
      setIsSellPanelOpen(false);
      setSellPriceYuan('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录失败');
    } finally {
      setIsSubmittingSell(false);
    }
  };

  const handleConfirmMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(maintPriceYuan);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('请输入有效的金额');
      return;
    }
    if (!maintAccountId) {
      toast.error('请选择支出账户');
      return;
    }

    setIsSubmittingMaint(true);
    try {
      await recordTransaction({
        type: 'expense',
        amount: yuanToCents(priceNum),
        accountId: maintAccountId,
        categoryId: isSub ? 'cat_digital' : 'cat_shop',
        date: maintDate,
        note: maintNote.trim() || (isSub ? `订阅续费: ${item.name}` : `配件/保养: ${item.name}`),
        ext: {
          'owned-items': {
            itemId: item.id,
            itemRole: 'maintenance',
            kind: item.kind,
          },
        },
      });

      setIsMaintPanelOpen(false);
      setMaintPriceYuan('');
      setMaintNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录支出失败');
    } finally {
      setIsSubmittingMaint(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: isSub ? '移除订阅记录' : '移除物品记录',
      message: `确定移除「${item.name}」吗？已关联合并的历史记账不会被删除。`,
      confirmText: '确认移除',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteItem(item.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败');
    }
  };

  const handleCancelSubscription = async () => {
    const today = new Date().toISOString().split('T')[0];
    const confirmed = await confirmAction({
      title: '取消/退订服务',
      message: `确定将「${item.name}」标记为已退订吗？`,
      confirmText: '确认退订',
      isDestructive: false,
    });
    if (!confirmed) return;

    try {
      await changeStatus(item.id, 'sold', today);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '退订失败');
    }
  };

  const handleResumeSubscription = async () => {
    try {
      await changeStatus(item.id, 'using', undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const getStatusStamp = (status: ItemStatus) => {
    switch (status) {
      case 'using':
        return (
          <span className="real-stamp text-(--color-income) -rotate-2 select-none text-[9px]">
            <span>{isSub ? '在订' : '在用'}</span>
          </span>
        );
      case 'idle':
        return (
          <span className="real-stamp text-(--color-accent) rotate-1 select-none text-[9px]">
            <span>{isSub ? '暂停' : '闲置'}</span>
          </span>
        );
      case 'sold':
      case 'scrapped':
        return (
          <span className="real-stamp text-(--ink-tertiary) rotate-2 select-none text-[9px]">
            <span>{isSub ? '已退订' : '已售出'}</span>
          </span>
        );
    }
  };

  const formatCycle = (cycle?: string) => {
    switch (cycle) {
      case 'monthly':
        return '按月';
      case 'yearly':
        return '按年';
      case 'quarterly':
        return '按季';
      case 'weekly':
        return '按周';
      default:
        return '';
    }
  };

  const getRoleTag = (tx: Transaction) => {
    const role = getOwnedItemExt(tx.ext)?.itemRole;
    if (role === 'buy') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
          {isSub ? '首次订阅' : '购入'}
        </span>
      );
    }
    if (role === 'maintenance') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
          {isSub ? '续费支出' : '配件保养'}
        </span>
      );
    }
    if (role === 'sell') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--color-income-bg) text-(--color-income) font-semibold">
          售出
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-tertiary)">
        关联记录
      </span>
    );
  };

  const renderSecondaryActionButton = () => {
    if (isSub) {
      if (item.status === 'using') {
        return (
          <button
            type="button"
            onClick={handleCancelSubscription}
            className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-tertiary) hover:text-(--color-expense) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
          >
            <span>退订服务</span>
          </button>
        );
      }
      return (
        <button
          type="button"
          onClick={handleResumeSubscription}
          className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--color-income) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-2" />
          <span>恢复在订</span>
        </button>
      );
    }

    if (item.status !== 'sold') {
      return (
        <button
          type="button"
          onClick={() => {
            setIsSellPanelOpen((prev) => !prev);
            setIsMaintPanelOpen(false);
          }}
          className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--color-income) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
        >
          <DollarSign className="w-3.5 h-3.5 stroke-2" />
          <span>售出</span>
        </button>
      );
    }

    return (
      <div className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sunken)/40 border border-transparent text-(--ink-tertiary) flex items-center justify-center gap-1.5 select-none">
        <Check className="w-3.5 h-3.5 stroke-2 text-(--color-income)" />
        <span>已售出</span>
      </div>
    );
  };

  return (
    <div className="w-full pb-20 select-none">
      <div className="sticky top-0 z-30 px-4.5 pt-[calc(0.25rem+var(--safe-top))] pb-1 bg-(--paper-base) border-b border-(--rule-hairline) flex items-center justify-between min-h-[calc(3rem+var(--safe-top))] box-border">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-solid) active:scale-95 transition-all cursor-pointer shadow-xs shrink-0"
            aria-label="返回清单"
          >
            <ChevronLeft className="w-4 h-4 stroke-2" />
          </button>
          <div className="min-w-0">
            <h1 className="font-serif not-italic text-xl sm:text-2xl text-(--ink-solid) leading-none truncate">
              {item.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openModal('item-form', { item })}
            className="w-7 h-7 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-solid) active:scale-95 transition-all cursor-pointer shadow-xs"
            title="编辑信息"
          >
            <Edit2 className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-7 h-7 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-tertiary) hover:text-(--color-expense) active:scale-95 transition-all cursor-pointer shadow-xs"
            title="移除"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3.5 space-y-4">
        <div className="relative bg-(--paper-sheet) paper-summary-card text-(--ink-solid) rounded-(--radius-lg) border border-(--rule-hairline) shadow-xs paper-deckle-bottom pb-4">
          <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

          <div className="p-4 pt-4 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-(--radius-sm) bg-(--paper-sunken) flex items-center justify-center text-(--ink-solid) shadow-2xs">
                  <ItemIcon className="w-4.5 h-4.5 stroke-[1.8]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-(--ink-solid) leading-snug">
                    {item.name}
                  </h2>
                  <div className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">
                    {isSub ? `${item.buyDate} 起订 · 订阅 ${metrics.holdingDays} 天` : `${item.buyDate} 购入 · 已使用 ${metrics.holdingDays} 天`}
                    {isSub && item.nextRenewalDate && ` · 下期 ${item.nextRenewalDate}`}
                  </div>
                </div>
              </div>

              <div>{getStatusStamp(item.status)}</div>
            </div>

            <div className="pt-2 border-t border-dashed border-(--rule-hairline)">
              <div className="text-[10px] font-mono text-(--ink-tertiary)">
                日均成本
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-(--color-income) tabular-nums">
                  ¥{centsToYuan(metrics.dailyCost)}
                </span>
                <span className="text-xs font-mono text-(--ink-tertiary)">/天</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-dashed border-(--rule-hairline) text-center">
              <div>
                <div className="text-[9px] font-mono text-(--ink-tertiary)">
                  {isSub ? '累计支出' : '累计投入'}
                </div>
                <div className="text-xs font-mono font-bold text-(--ink-solid) mt-0.5 tabular-nums">
                  ¥{centsToYuan(metrics.grossCost)}
                </div>
              </div>

              {isSub ? (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">续费周期</div>
                  <div className="text-xs font-mono font-bold text-(--ink-primary) mt-0.5">
                    {formatCycle(item.billingCycle) || '按月'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">售出回款</div>
                  <div className="text-xs font-mono font-bold text-(--color-income) mt-0.5 tabular-nums">
                    ¥{centsToYuan(metrics.recoveredAmount)}
                  </div>
                </div>
              )}

              {isSub ? (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">单期金额</div>
                  <div className="text-xs font-mono font-bold text-(--ink-solid) mt-0.5 tabular-nums">
                    {item.renewalAmountCents ? `¥${centsToYuan(item.renewalAmountCents)}` : '-'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">净支出</div>
                  <div className="text-xs font-mono font-bold text-(--ink-solid) mt-0.5 tabular-nums">
                    ¥{centsToYuan(metrics.netCost)}
                  </div>
                </div>
              )}

              {isSub ? (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">扣费笔数</div>
                  <div className="text-xs font-mono font-bold text-(--color-income) mt-0.5 tabular-nums">
                    {itemTransactions.length}笔
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[9px] font-mono text-(--ink-tertiary)">保值率</div>
                  <div className="text-xs font-mono font-bold text-(--color-income) mt-0.5 tabular-nums">
                    {metrics.recoveredAmount > 0 && metrics.retentionRate !== null ? `${metrics.retentionRate}%` : '-'}
                  </div>
                </div>
              )}
            </div>

            {item.note && (
              <div className="pt-2 border-t border-dashed border-(--rule-hairline)/70 text-[11px] text-(--ink-secondary) italic">
                “{item.note}”
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              if (isSub && item.renewalAmountCents && !maintPriceYuan) {
                setMaintPriceYuan(centsToYuan(item.renewalAmountCents));
              }
              setIsMaintPanelOpen((prev) => !prev);
              setIsSellPanelOpen(false);
            }}
            className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-solid) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-2 text-(--color-expense)" />
            <span>{isSub ? '记续费支出' : '记关联支出'}</span>
          </button>

          {renderSecondaryActionButton()}
        </div>

        {isMaintPanelOpen && (
          <form
            onSubmit={handleConfirmMaint}
            className="p-3.5 bg-(--paper-sheet) paper-card border border-(--rule-strong) rounded-(--radius-md) shadow-xs space-y-3"
          >
            <div className="text-xs font-semibold text-(--ink-solid)">
              {isSub ? '记录续费支出' : '记录配件/维护支出'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  支出金额 (元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={maintPriceYuan}
                  onChange={(e) => setMaintPriceYuan(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-sm font-semibold text-(--ink-solid) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  支付账户
                </label>
                <select
                  value={maintAccountId}
                  onChange={(e) => setMaintAccountId(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  记账日期
                </label>
                <input
                  type="date"
                  value={maintDate}
                  onChange={(e) => setMaintDate(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  支出备注
                </label>
                <input
                  type="text"
                  value={maintNote}
                  onChange={(e) => setMaintNote(e.target.value)}
                  placeholder={isSub ? '例如：月度续费、会员升级' : '例如：保护壳、贴膜、换电池'}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-secondary) outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsMaintPanelOpen(false)}
                className="px-3 py-1 text-(--ink-tertiary) hover:text-(--ink-primary) cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmittingMaint}
                className="px-3.5 py-1 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) font-semibold active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                确认记录
              </button>
            </div>
          </form>
        )}

        {isSellPanelOpen && (
          <form
            onSubmit={handleConfirmSell}
            className="p-3.5 bg-(--paper-sheet) paper-card border border-(--rule-strong) rounded-(--radius-md) shadow-xs space-y-3"
          >
            <div className="text-xs font-semibold text-(--ink-solid)">二手售出回血</div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  售出回血金额 (元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPriceYuan}
                  onChange={(e) => setSellPriceYuan(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-sm font-semibold text-(--color-income) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  回血入账账户
                </label>
                <select
                  value={sellAccountId}
                  onChange={(e) => setSellAccountId(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  售出日期
                </label>
                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-(--ink-tertiary) mb-1">
                  售出备注
                </label>
                <input
                  type="text"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                  placeholder="例如：海鲜市场售出、出给朋友"
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-secondary) outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsSellPanelOpen(false)}
                className="px-3 py-1 text-(--ink-tertiary) hover:text-(--ink-primary) cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmittingSell}
                className="px-3.5 py-1 rounded-(--btn-radius) bg-(--color-income) text-white font-semibold active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                确认结案
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs font-mono text-(--ink-tertiary)">
            <span>{isSub ? '扣费流水明细' : '关联流水'}</span>
            <span>共 {itemTransactions.length} 笔</span>
          </div>

          {itemTransactions.length > 0 ? (
            <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-md) overflow-hidden shadow-xs divide-y divide-dashed divide-(--rule-hairline)/60">
              {itemTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <div
                    key={tx.id}
                    className="p-3 flex items-center justify-between hover:bg-(--paper-hover)/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-(--ink-solid) truncate">
                            {tx.note || (isIncome ? '售出收入' : '支出')}
                          </span>
                          {getRoleTag(tx)}
                        </div>
                        <div className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">
                          {tx.date}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          'font-mono text-xs font-bold tabular-nums',
                          isIncome ? 'text-(--color-income)' : 'text-(--ink-solid)'
                        )}
                      >
                        {isIncome ? `+¥${centsToYuan(tx.amount)}` : `-¥${centsToYuan(tx.amount)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-(--ink-tertiary) bg-(--paper-sheet) paper-card border border-dashed border-(--rule-hairline) rounded-(--radius-md)">
              暂无关联记账流水
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
