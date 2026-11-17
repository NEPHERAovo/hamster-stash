import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  ArrowRightLeft,
  Check,
} from 'lucide-react';
import {
  useHostTransactions,
  useHostAccounts,
  useHostTransactionActions,
  usePluginNavigation,
  centsToYuan,
  yuanToCents,
  getCategoryIcon,
  toast,
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
        <p>未找到该物品信息</p>
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
      toast.error('请输入有效的售出金额');
      return;
    }
    if (!sellAccountId) {
      toast.error('请选择回血入账账户');
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
      toast.success(`物品已售出回血 ¥${priceNum.toFixed(2)}`);
      setIsSellPanelOpen(false);
      setSellPriceYuan('');
      setSellNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '售出失败');
    } finally {
      setIsSubmittingSell(false);
    }
  };

  const handleConfirmMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(maintPriceYuan);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('请输入有效的支出金额');
      return;
    }
    if (!maintAccountId) {
      toast.error('请选择扣款账户');
      return;
    }

    setIsSubmittingMaint(true);
    try {
      await recordTransaction({
        type: 'expense',
        amount: yuanToCents(priceNum),
        accountId: maintAccountId,
        categoryId: 'cat_shop',
        date: maintDate,
        note: maintNote.trim() || `配件保养: ${item.name}`,
        ext: {
          'owned-items': {
            itemId: item.id,
            itemRole: 'maintenance',
          },
        },
      });

      toast.success(`已记录支出 ¥${priceNum.toFixed(2)}`);
      setIsMaintPanelOpen(false);
      setMaintPriceYuan('');
      setMaintNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录失败');
    } finally {
      setIsSubmittingMaint(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`确定要从手帐中移除物品「${item.name}」吗？（关联的历史流水不会被删除，仅解除物品关联）`)) {
      try {
        await deleteItem(item.id);
        toast.info('物品已移除');
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败');
      }
    }
  };

  const getStatusStamp = (status: ItemStatus) => {
    switch (status) {
      case 'using':
        return <span className="real-stamp text-(--color-income) -rotate-2 select-none text-[10px]">USING · 在用</span>;
      case 'idle':
        return <span className="real-stamp text-(--ink-tertiary) rotate-1 select-none text-[10px]">IDLE · 闲置</span>;
      case 'sold':
        return <span className="real-stamp text-(--color-expense) -rotate-3 select-none text-[10px]">SOLD · 已售出</span>;
      case 'scrapped':
        return <span className="real-stamp text-(--ink-primary) rotate-2 select-none text-[10px]">SCRAP · 已报废</span>;
    }
  };

  const getItemRoleBadge = (tx: Transaction) => {
    const role = getOwnedItemExt(tx.ext)?.itemRole;
    if (role === 'buy') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--color-expense-bg) text-(--color-expense) font-semibold">
          首次购入
        </span>
      );
    }
    if (role === 'maintenance') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
          配件保养
        </span>
      );
    }
    if (role === 'sell') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--color-income-bg) text-(--color-income) font-semibold">
          售出回血
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-tertiary)">
        关联记录
      </span>
    );
  };

  return (
    <div className="w-full pb-20 animate-fade-in select-none">
      <div className="sticky top-0 z-30 px-4.5 pt-[calc(0.625rem+var(--safe-top))] pb-2 bg-(--paper-base)/90 backdrop-blur-md border-b border-(--rule-hairline) flex items-center justify-between min-h-[calc(3.5rem+var(--safe-top))] box-border">
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
            title="编辑物品信息"
          >
            <Edit2 className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-7 h-7 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-tertiary) hover:text-(--color-expense) active:scale-95 transition-all cursor-pointer shadow-xs"
            title="移除物品"
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
                    {item.buyDate} 购入 · 已持有 {metrics.holdingDays} 天
                  </div>
                </div>
              </div>

              <div>{getStatusStamp(item.status)}</div>
            </div>

            <div className="pt-2 border-t border-dashed border-(--rule-hairline)">
              <div className="text-[10px] font-mono text-(--ink-tertiary)">日均持有成本</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-(--color-income) tabular-nums">
                  ¥{centsToYuan(metrics.dailyCost)}
                </span>
                <span className="text-xs font-mono text-(--ink-tertiary)">/天</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-dashed border-(--rule-hairline) text-center">
              <div>
                <div className="text-[9px] font-mono text-(--ink-tertiary)">累计投入</div>
                <div className="text-xs font-mono font-bold text-(--ink-solid) mt-0.5 tabular-nums">
                  ¥{centsToYuan(metrics.grossCost)}
                </div>
              </div>

              <div>
                <div className="text-[9px] font-mono text-(--ink-tertiary)">售出回血</div>
                <div className="text-xs font-mono font-bold text-(--color-income) mt-0.5 tabular-nums">
                  ¥{centsToYuan(metrics.recoveredAmount)}
                </div>
              </div>

              <div>
                <div className="text-[9px] font-mono text-(--ink-tertiary)">净持有成本</div>
                <div className="text-xs font-mono font-bold text-(--ink-solid) mt-0.5 tabular-nums">
                  ¥{centsToYuan(metrics.netCost)}
                </div>
              </div>

              <div>
                <div className="text-[9px] font-mono text-(--ink-tertiary)">保值率</div>
                <div className="text-xs font-mono font-bold text-(--color-income) mt-0.5 tabular-nums">
                  {metrics.recoveredAmount > 0 && metrics.retentionRate !== null ? `${metrics.retentionRate}%` : '-'}
                </div>
              </div>
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
              setIsMaintPanelOpen((prev) => !prev);
              setIsSellPanelOpen(false);
            }}
            className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-solid) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-2 text-(--color-expense)" />
            <span>记关联支出</span>
          </button>

          {item.status !== 'sold' ? (
            <button
              type="button"
              onClick={() => {
                setIsSellPanelOpen((prev) => !prev);
                setIsMaintPanelOpen(false);
              }}
              className="py-2 px-3 rounded-(--btn-radius) bg-(--color-accent-bg) border border-(--color-accent)/30 text-(--color-accent) font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:border-(--color-accent) active:scale-95 transition-all cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 stroke-2" />
              <span>二手售出回血</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => changeStatus(item.id, 'using')}
              className="py-2 px-3 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-secondary) flex items-center justify-center gap-1.5 shadow-xs hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 stroke-2" />
              <span>重新设为在用</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono text-(--ink-tertiary)">
          <span>快速标记状态:</span>
          <div className="flex items-center gap-1.5">
            {(['using', 'idle', 'scrapped'] as ItemStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => changeStatus(item.id, st)}
                className={cn(
                  'px-2 py-0.5 rounded-(--btn-radius) transition-colors cursor-pointer',
                  item.status === st
                    ? 'bg-(--paper-sunken) text-(--ink-solid) font-bold'
                    : 'hover:text-(--ink-secondary)'
                )}
              >
                {st === 'using' ? '在用' : st === 'idle' ? '闲置' : '报废'}
              </button>
            ))}
          </div>
        </div>

        {isMaintPanelOpen && (
          <form
            onSubmit={handleConfirmMaint}
            className="p-3.5 bg-(--paper-sheet) paper-card rounded-(--radius-md) border border-(--rule-hairline) shadow-xs space-y-3 animate-fade-in text-xs font-mono"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-(--rule-hairline)">
              <span className="font-semibold text-(--ink-solid)">记关联支出 / 配件保养</span>
              <button
                type="button"
                onClick={() => setIsMaintPanelOpen(false)}
                className="text-[10px] text-(--ink-tertiary) hover:text-(--ink-primary) cursor-pointer"
              >
                收起
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">
                  支出金额 (元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={maintPriceYuan}
                  onChange={(e) => setMaintPriceYuan(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">
                  扣款账户
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">支出日期</label>
                <input
                  type="date"
                  value={maintDate}
                  onChange={(e) => setMaintDate(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">用途备注 (选填)</label>
                <input
                  type="text"
                  value={maintNote}
                  onChange={(e) => setMaintNote(e.target.value)}
                  placeholder="如: 官方磁吸壳、贴膜"
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingMaint}
              className="w-full py-1.5 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) font-semibold flex items-center justify-center gap-1 active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5 stroke-2" />
              <span>确认记入支出</span>
            </button>
          </form>
        )}

        {isSellPanelOpen && (
          <form
            onSubmit={handleConfirmSell}
            className="p-3.5 bg-(--paper-sheet) paper-card rounded-(--radius-md) border border-(--rule-hairline) shadow-xs space-y-3 animate-fade-in text-xs font-mono"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-(--rule-hairline)">
              <span className="font-semibold text-(--ink-solid)">二手售出回血入账</span>
              <button
                type="button"
                onClick={() => setIsSellPanelOpen(false)}
                className="text-[10px] text-(--ink-tertiary) hover:text-(--ink-primary) cursor-pointer"
              >
                收起
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">
                  售出回血金额 (元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPriceYuan}
                  onChange={(e) => setSellPriceYuan(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 font-mono text-xs text-(--ink-solid) outline-none font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">售出日期</label>
                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-(--ink-tertiary) mb-1">随笔备注 (选填)</label>
                <input
                  type="text"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                  placeholder="如: 闲鱼同城自提"
                  className="w-full bg-transparent border-b border-dashed border-(--rule-hairline) py-1 text-xs text-(--ink-solid) outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingSell}
              className="w-full py-1.5 rounded-(--btn-radius) bg-(--color-accent) text-white font-semibold flex items-center justify-center gap-1 active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5 stroke-2" />
              <span>确认回血并标记售出</span>
            </button>
          </form>
        )}

        <div className="bg-(--paper-sheet) paper-card text-(--ink-solid) rounded-(--radius-md) border border-(--rule-hairline) shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-dashed border-(--rule-hairline) flex items-center justify-between">
            <span className="text-xs font-semibold text-(--ink-solid)">关联账单</span>
            <span className="text-[10px] font-mono text-(--ink-tertiary)">
              共 {itemTransactions.length} 笔关联
            </span>
          </div>

          {itemTransactions.length > 0 ? (
            <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
              {itemTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-4 py-2.5 flex items-center justify-between text-xs select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div>{getItemRoleBadge(tx)}</div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-(--ink-primary)">
                        {tx.note || (tx.type === 'income' ? '二手回血' : '配件/支出')}
                      </div>
                      <div className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">
                        {tx.date}
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'font-mono font-bold tabular-nums text-sm shrink-0 ml-2',
                      tx.type === 'income' ? 'text-(--color-income)' : 'text-(--ink-solid)'
                    )}
                  >
                    {tx.type === 'income' ? '+' : '-'}¥{centsToYuan(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-(--ink-tertiary)">
              暂无关联记录，点击上方「记关联支出」开始记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
