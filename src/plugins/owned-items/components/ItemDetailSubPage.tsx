import React, { useState, useMemo } from 'react';
import { CaretLeftIcon as ChevronLeft, PlusIcon as Plus, TrashIcon as Trash2, PencilSimpleIcon as Edit2, CoinsIcon as DollarSign, ArrowCounterClockwiseIcon as RotateCcw, CalendarBlankIcon as CalendarBlank, MagnifyingGlassIcon as Search, XIcon as X } from '@phosphor-icons/react';
import {
  useHostTransactions,
  useHostAccounts,
  useHostCategories,
  useHostTransactionActions,
  usePluginNavigation,
  centsToYuan,
  yuanToCents,
  getCategoryIcon,
  toast,
  confirmAction,
  cn,
  PaperButton,
  PaperIconButton,
  PaperInput,
  PaperSelect,
  AmountInput,
  SegToggle,
  PaperDatePickerModal,
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
  const { deleteItem, changeStatus, updateItem } = usePluginItemStore();
  const transactions = useHostTransactions();
  const accounts = useHostAccounts();
  const hostCategories = useHostCategories();
  const { recordTransaction, updateTransaction } = useHostTransactionActions();
  const { openModal } = usePluginNavigation();

  const [isSellPanelOpen, setIsSellPanelOpen] = useState(false);
  const [dispositionMode, setDispositionMode] = useState<'sold' | 'gifted' | 'scrapped'>('sold');
  const [sellPriceYuan, setSellPriceYuan] = useState('');
  const [sellAccountId, setSellAccountId] = useState(accounts[0]?.id || '');
  const [sellDate, setSellDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSellDateOpen, setIsSellDateOpen] = useState(false);
  const [sellNote, setSellNote] = useState('');
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);

  const [isMaintPanelOpen, setIsMaintPanelOpen] = useState(false);
  const [maintMode, setMaintMode] = useState<'existing' | 'new'>('existing');
  const [searchBillQuery, setSearchBillQuery] = useState('');
  const [maintPriceYuan, setMaintPriceYuan] = useState('');
  const [maintAccountId, setMaintAccountId] = useState(accounts[0]?.id || '');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMaintDateOpen, setIsMaintDateOpen] = useState(false);
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

  const linkedTxIds = useMemo(() => {
    return new Set(itemTransactions.map((t) => t.id));
  }, [itemTransactions]);

  const candidateExpenses = useMemo(() => {
    const unlinked = transactions.filter((t) => t.type === 'expense' && !linkedTxIds.has(t.id));
    const q = searchBillQuery.trim().toLowerCase();
    if (!q) {
      return unlinked.slice(0, 30);
    }
    return unlinked
      .filter((t) => {
        const cat = hostCategories.find((c) => c.id === t.categoryId);
        const acct = accounts.find((a) => a.id === t.accountId);
        if (t.note?.toLowerCase().includes(q)) return true;
        if (cat?.name.toLowerCase().includes(q)) return true;
        if (acct?.name.toLowerCase().includes(q)) return true;
        if (centsToYuan(t.amount).includes(q)) return true;
        return false;
      })
      .slice(0, 50);
  }, [transactions, linkedTxIds, searchBillQuery, hostCategories, accounts]);

  const handleLinkTransaction = async (tx: Transaction) => {
    if (!item) return;
    const hasBuy = itemTransactions.some((t) => getOwnedItemExt(t.ext)?.itemRole === 'buy');
    let role: 'buy' | 'maintenance' = 'maintenance';
    if (!hasBuy && (!item.kind || item.kind === 'physical')) {
      const asBuy = await confirmAction({
        title: '选择关联角色',
        message: `是否将这笔「¥${centsToYuan(tx.amount)}」设为「${item.name}」的【初始购入账单】？（点击取消则作为配件/保养支出）`,
        confirmText: '设为初始购入',
        cancelText: '作为配件保养',
        isDestructive: false,
      });
      role = asBuy ? 'buy' : 'maintenance';
    }

    try {
      await updateTransaction(tx.id, {
        ext: {
          ...(tx.ext || {}),
          'owned-items': {
            itemId: item.id,
            itemRole: role,
            kind: item.kind,
          },
        },
      });
      if (role === 'buy' && tx.date) {
        await updateItem(item.id, { buyDate: tx.date });
      }
      setIsMaintPanelOpen(false);
      setSearchBillQuery('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '关联失败');
    }
  };

  const handleUnlinkTransaction = async (tx: Transaction) => {
    const confirmed = await confirmAction({
      title: '解除关联',
      message: '确定将本笔支出从该物品中移除关联吗？账单本身不会被删除。',
      confirmText: '解除关联',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const nextExt = { ...(tx.ext || {}) };
      delete nextExt['owned-items'];
      await updateTransaction(tx.id, { ext: nextExt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '解除关联失败');
    }
  };

  if (!item || !metrics) {
    return (
      <div className="space-y-3 p-8 text-center text-xs text-(--ink-tertiary)">
        <p>未找到该项信息</p>
        <PaperButton
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          返回清单
        </PaperButton>
      </div>
    );
  }

  const ItemIcon = getCategoryIcon(item.icon);

  const handleConfirmSell = async (e: React.SyntheticEvent) => {
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
        note: sellNote.trim() || `二手售出: ${item.name}`,
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

  const handleConfirmGift = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsSubmittingSell(true);
    try {
      if (sellNote.trim()) {
        await updateItem(item.id, { note: sellNote.trim() });
      }
      await changeStatus(item.id, 'gifted', sellDate);
      setIsSellPanelOpen(false);
      setSellNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录转赠失败');
    } finally {
      setIsSubmittingSell(false);
    }
  };

  const handleConfirmScrap = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsSubmittingSell(true);
    try {
      if (sellNote.trim()) {
        await updateItem(item.id, { note: sellNote.trim() });
      }
      await changeStatus(item.id, 'scrapped', sellDate);
      setIsSellPanelOpen(false);
      setSellNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录报废失败');
    } finally {
      setIsSubmittingSell(false);
    }
  };

  const handleResumeUsing = async () => {
    const confirmed = await confirmAction({
      title: '恢复在用',
      message: `确定将「${item.name}」恢复为在用状态吗？`,
      confirmText: '确认恢复',
      isDestructive: false,
    });
    if (!confirmed) return;

    try {
      await changeStatus(item.id, 'using', undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const getRecoveredTitle = () => {
    if (item.status === 'gifted') return '已转赠';
    if (item.status === 'scrapped') return '已报废';
    return '售出回款';
  };

  const getDispositionDateLabel = () => {
    if (dispositionMode === 'sold') return '售出日期';
    if (dispositionMode === 'gifted') return '转赠日期';
    return '报废日期';
  };

  const getDispositionNoteLabel = () => {
    if (dispositionMode === 'sold') return '售出备注';
    if (dispositionMode === 'gifted') return '转赠对象/备注';
    return '报废原因';
  };

  const getDispositionNotePlaceholder = () => {
    if (dispositionMode === 'sold') return '输入售出说明';
    if (dispositionMode === 'gifted') return '如：赠予好友';
    return '如：损坏丢弃';
  };

  const getDispositionButtonLabel = () => {
    if (dispositionMode === 'sold') return '确认售出';
    if (dispositionMode === 'gifted') return '确认转赠';
    return '确认报废';
  };

  const handleDispositionSubmit = (e: React.SyntheticEvent) => {
    if (dispositionMode === 'sold') {
      void handleConfirmSell(e);
      return;
    }
    if (dispositionMode === 'gifted') {
      void handleConfirmGift(e);
      return;
    }
    void handleConfirmScrap(e);
  };

  const handleConfirmMaint = async (e: React.SyntheticEvent) => {
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
      title: '退订服务',
      message: `确定将「${item.name}」标记为已退吗？`,
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
    if (status === 'sold') {
      return (
        <span className="real-stamp text-[9px] text-(--ink-tertiary) select-none">
          <span>{isSub ? '已退' : '已出'}</span>
        </span>
      );
    }
    if (status === 'gifted') {
      return (
        <span className="real-stamp text-[9px] text-(--color-income) select-none">
          <span>已转赠</span>
        </span>
      );
    }
    if (status === 'scrapped') {
      return (
        <span className="real-stamp text-[9px] text-(--color-expense) select-none">
          <span>已报废</span>
        </span>
      );
    }
    return (
      <span className="real-stamp text-[9px] text-(--color-income) select-none">
        <span>{isSub ? '在订' : '在用'}</span>
      </span>
    );
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
        <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-secondary)">
          {isSub ? '首次订阅' : '购入'}
        </span>
      );
    }
    if (role === 'maintenance') {
      return (
        <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-secondary)">
          {isSub ? '续费支出' : '配件保养'}
        </span>
      );
    }
    if (role === 'sell') {
      return (
        <span className="rounded-(--badge-radius) bg-(--color-income-bg) px-1.5 py-0.5 font-mono text-[9px] font-semibold text-(--color-income)">
          售出
        </span>
      );
    }
    return (
      <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-tertiary)">
        关联记录
      </span>
    );
  };

  const renderSecondaryActionButton = () => {
    if (isSub) {
      if (item.status === 'using') {
        return (
          <PaperButton
            variant="secondary"
            size="compact"
            onClick={handleCancelSubscription}
          >
            退订服务
          </PaperButton>
        );
      }
      return (
        <PaperButton
          variant="income"
          size="compact"
          leftIcon={<RotateCcw className="size-3.5 stroke-2" />}
          onClick={handleResumeSubscription}
        >
          恢复在订
        </PaperButton>
      );
    }

    const isEnded = item.status === 'sold' || item.status === 'gifted' || item.status === 'scrapped';
    if (!isEnded) {
      return (
        <PaperButton
          variant="income"
          size="compact"
          leftIcon={<DollarSign className="size-3.5 stroke-2" />}
          onClick={() => {
            setIsSellPanelOpen((prev) => !prev);
            setIsMaintPanelOpen(false);
          }}
        >
          售出 / 处置
        </PaperButton>
      );
    }

    return (
      <PaperButton
        variant="secondary"
        size="compact"
        leftIcon={<RotateCcw className="size-3.5 stroke-2" />}
        onClick={handleResumeUsing}
      >
        恢复在用
      </PaperButton>
    );
  };

  return (
    <div className="w-full pb-20 select-none">
      <div className="sticky top-0 z-30 box-border flex min-h-[calc(3rem+var(--safe-top))] items-center justify-between border-b border-(--rule-hairline) bg-(--paper-base) px-4.5 pt-[calc(0.25rem+var(--safe-top))] pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <PaperIconButton
            icon={ChevronLeft}
            size="md"
            variant="surface"
            onClick={onClose}
            aria-label="返回清单"
          />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl leading-none text-(--ink-solid) not-italic sm:text-2xl">
              {isSub ? '订阅详情' : '物品详情'}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <PaperIconButton
            icon={Edit2}
            size="md"
            variant="surface"
            onClick={() => openModal('item-form', { item })}
            title="编辑信息"
            aria-label="编辑信息"
          />
          <PaperIconButton
            icon={Trash2}
            size="md"
            variant="surface"
            onClick={handleDelete}
            title="移除"
            aria-label="移除"
          />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-3.5">
        <div className="paper-summary-card paper-deckle-bottom relative rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) pb-4 text-(--ink-solid) shadow-xs">
          <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

          <div className="space-y-3.5 p-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-(--radius-sm) bg-(--paper-sunken) text-(--ink-solid) shadow-2xs">
                  <ItemIcon className="stroke-1.8 size-4.5" />
                </div>
                <div>
                  <h2 className="text-base leading-snug font-bold text-(--ink-solid)">
                    {item.name}
                  </h2>
                  <div className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">
                    {isSub ? `${item.buyDate} 起订 · 订阅 ${metrics.holdingDays} 天` : `${item.buyDate} 购入 · 已使用 ${metrics.holdingDays} 天`}
                    {isSub && item.nextRenewalDate && ` · 下期 ${item.nextRenewalDate}`}
                  </div>
                </div>
              </div>

              <div>{getStatusStamp(item.status)}</div>
            </div>

            <div className="border-t border-dashed border-(--rule-hairline) pt-2">
              <div className="font-mono text-[10px] text-(--ink-tertiary)">
                日均成本
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-mono text-3xl font-bold tracking-tight text-(--color-income) tabular-nums sm:text-4xl">
                  ¥{centsToYuan(metrics.dailyCost)}
                </span>
                <span className="font-mono text-xs text-(--ink-tertiary)">/天</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 border-t border-dashed border-(--rule-hairline) pt-2 text-center">
              <div>
                <div className="font-mono text-[9px] text-(--ink-tertiary)">
                  {isSub ? '累计支出' : '累计投入'}
                </div>
                <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                  ¥{centsToYuan(metrics.grossCost)}
                </div>
              </div>

              {isSub ? (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">续费周期</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-primary)">
                    {formatCycle(item.billingCycle) || '按月'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">{getRecoveredTitle()}</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                    ¥{centsToYuan(metrics.recoveredAmount)}
                  </div>
                </div>
              )}

              {isSub ? (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">续费金额</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                    {item.renewalAmountCents ? `¥${centsToYuan(item.renewalAmountCents)}` : '-'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">净支出</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                    ¥{centsToYuan(metrics.netCost)}
                  </div>
                </div>
              )}

              {isSub ? (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">扣费笔数</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                    {itemTransactions.length}笔
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-mono text-[9px] text-(--ink-tertiary)">保值率</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                    {metrics.recoveredAmount > 0 && metrics.retentionRate !== null ? `${metrics.retentionRate}%` : '-'}
                  </div>
                </div>
              )}
            </div>

            {item.note && (
              <div className="border-t border-dashed border-(--rule-hairline)/70 pt-2 text-[11px] text-(--ink-secondary) italic">
                “{item.note}”
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<Plus className="size-3.5 stroke-2 text-(--color-expense)" />}
            onClick={() => {
              if (isSub && item.renewalAmountCents && !maintPriceYuan) {
                setMaintPriceYuan(centsToYuan(item.renewalAmountCents));
              }
              setIsMaintPanelOpen((prev) => !prev);
              setIsSellPanelOpen(false);
            }}
          >
            {isSub ? '续费支出' : '关联支出'}
          </PaperButton>

          {renderSecondaryActionButton()}
        </div>

        {isMaintPanelOpen && (
          <div className="paper-card space-y-3 rounded-(--radius-md) border border-(--rule-strong) bg-(--paper-sheet) p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-(--ink-solid)">
                {isSub ? '关联续费' : '关联支出'}
              </div>
              <SegToggle
                options={[
                  { value: 'existing', label: '选已有账单' },
                  { value: 'new', label: isSub ? '记新续费' : '记新支出' },
                ]}
                value={maintMode}
                onChange={(val) => setMaintMode(val as 'existing' | 'new')}
                size="sm"
                fullWidth={false}
              />
            </div>

            {maintMode === 'existing' ? (
              <div className="space-y-2">
                <PaperInput
                  size="sm"
                  value={searchBillQuery}
                  onChange={(e) => setSearchBillQuery(e.target.value)}
                  placeholder="搜索备注、分类、账户、金额..."
                  leftIcon={<Search className="size-3.5 text-(--ink-tertiary)" />}
                  clearable={Boolean(searchBillQuery)}
                  onClear={() => setSearchBillQuery('')}
                />

                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                  {candidateExpenses.length === 0 ? (
                    <div className="py-6 text-center font-mono text-xs text-(--ink-tertiary)">
                      {searchBillQuery ? '未找到相关支出' : '暂无可选支出账单'}
                    </div>
                  ) : (
                    candidateExpenses.map((tx) => {
                      const cat = hostCategories.find((c) => c.id === tx.categoryId);
                      const acct = accounts.find((a) => a.id === tx.accountId);
                      const CatIcon = getCategoryIcon(cat?.icon || 'squares-four');
                      return (
                        <div
                          key={tx.id}
                          onClick={() => handleLinkTransaction(tx)}
                          className="flex cursor-pointer items-center justify-between rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken)/40 p-2.5 transition-colors hover:border-(--border-strong) hover:bg-(--paper-hover)"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-(--radius-xs) bg-(--paper-sheet) text-(--ink-primary)">
                              <CatIcon className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-(--ink-solid)">
                                {tx.note || cat?.name || '支出'}
                              </div>
                              <div className="font-mono text-[10px] text-(--ink-tertiary)">
                                {tx.date} · {acct?.name || '账户'}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                            -¥{centsToYuan(tx.amount)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-(--ink-tertiary)">
                  <span>{searchBillQuery ? `搜索结果 ${candidateExpenses.length} 笔` : '展示最近 30 笔未关联支出'}</span>
                  <PaperButton variant="secondary" size="xs" onClick={() => setIsMaintPanelOpen(false)}>
                    关闭
                  </PaperButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmMaint} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                      支出金额
                    </label>
                    <AmountInput
                      size="sm"
                      value={maintPriceYuan}
                      onChange={setMaintPriceYuan}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                      支付账户
                    </label>
                    <PaperSelect
                      size="sm"
                      value={maintAccountId}
                      onChange={(e) => setMaintAccountId(e.target.value)}
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
                      onClick={() => setIsMaintDateOpen(true)}
                      className="justify-start gap-2 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
                      leftIcon={<CalendarBlank className="size-3 shrink-0 text-(--ink-tertiary)" />}
                    >
                      <span>{maintDate || '选择日期'}</span>
                    </PaperButton>
                    <PaperDatePickerModal
                      isOpen={isMaintDateOpen}
                      onClose={() => setIsMaintDateOpen(false)}
                      mode="date"
                      value={maintDate}
                      onChange={(val) => setMaintDate(val)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                      支出备注
                    </label>
                    <PaperInput
                      size="sm"
                      type="text"
                      value={maintNote}
                      onChange={(e) => setMaintNote(e.target.value)}
                      placeholder="输入支出备注"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
                  <PaperButton
                    variant="secondary"
                    size="compact"
                    onClick={() => setIsMaintPanelOpen(false)}
                  >
                    取消
                  </PaperButton>
                  <PaperButton
                    variant="primary"
                    size="compact"
                    type="submit"
                    disabled={isSubmittingMaint}
                  >
                    确认记录
                  </PaperButton>
                </div>
              </form>
            )}
          </div>
        )}

        {isSellPanelOpen && (
          <form
            onSubmit={handleDispositionSubmit}
            className="paper-card space-y-3 rounded-(--radius-md) border border-(--rule-strong) bg-(--paper-sheet) p-3.5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-(--ink-solid)">处置物品</div>
              <SegToggle
                options={[
                  { value: 'sold', label: '二手售出' },
                  { value: 'gifted', label: '转赠他人' },
                  { value: 'scrapped', label: '废弃报废' },
                ]}
                value={dispositionMode}
                onChange={(val) => setDispositionMode(val as 'sold' | 'gifted' | 'scrapped')}
                size="sm"
                fullWidth={false}
              />
            </div>

            {dispositionMode === 'sold' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                    售出金额
                  </label>
                  <AmountInput
                    size="sm"
                    value={sellPriceYuan}
                    onChange={setSellPriceYuan}
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
                    onChange={(e) => setSellAccountId(e.target.value)}
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
                <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                  {getDispositionDateLabel()}
                </label>
                <PaperButton
                  variant="sunken"
                  size="sm"
                  fullWidth
                  onClick={() => setIsSellDateOpen(true)}
                  className="justify-start gap-2 border-(--rule-hairline) px-2.5 font-mono text-xs text-(--ink-primary) hover:border-(--border-strong)"
                  leftIcon={<CalendarBlank className="size-3 shrink-0 text-(--ink-tertiary)" />}
                >
                  <span>{sellDate || '选择日期'}</span>
                </PaperButton>
                <PaperDatePickerModal
                  isOpen={isSellDateOpen}
                  onClose={() => setIsSellDateOpen(false)}
                  mode="date"
                  value={sellDate}
                  onChange={(val) => setSellDate(val)}
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] text-(--ink-tertiary)">
                  {getDispositionNoteLabel()}
                </label>
                <PaperInput
                  size="sm"
                  type="text"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                  placeholder={getDispositionNotePlaceholder()}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
              <PaperButton
                variant="secondary"
                size="compact"
                onClick={() => setIsSellPanelOpen(false)}
              >
                取消
              </PaperButton>
              <PaperButton
                variant="income"
                size="compact"
                type="submit"
                disabled={isSubmittingSell}
              >
                {getDispositionButtonLabel()}
              </PaperButton>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 font-mono text-xs text-(--ink-tertiary)">
            <span>{isSub ? '扣费流水明细' : '关联流水'}</span>
            <span>共 {itemTransactions.length} 笔</span>
          </div>

          {itemTransactions.length > 0 ? (
            <div className="paper-card divide-y divide-dashed divide-(--rule-hairline)/60 overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
              {itemTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 transition-colors hover:bg-(--paper-hover)/50"
                  >
                    <div className="mr-3 flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-(--ink-solid)">
                            {tx.note || (isIncome ? '售出收入' : '支出')}
                          </span>
                          {getRoleTag(tx)}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">
                          {tx.date}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <span
                        className={cn(
                          'font-mono text-xs font-bold tabular-nums',
                          isIncome ? 'text-(--color-income)' : 'text-(--ink-solid)'
                        )}
                      >
                        {isIncome ? `+¥${centsToYuan(tx.amount)}` : `-¥${centsToYuan(tx.amount)}`}
                      </span>
                      <PaperIconButton
                        icon={X}
                        size="xs"
                        variant="ghost"
                        onClick={() => handleUnlinkTransaction(tx)}
                        className="text-(--ink-faint) hover:text-(--color-expense)"
                        title="解除关联"
                        aria-label="解除关联"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="paper-card rounded-(--radius-md) border border-dashed border-(--rule-hairline) bg-(--paper-sheet) py-6 text-center font-mono text-xs text-(--ink-tertiary)">
              暂无关联记账流水
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
