import React, { useState, useMemo, useRef } from 'react';
import {
  CaretLeftIcon as ChevronLeft,
  PlusIcon as Plus,
  TrashIcon as Trash2,
  PencilSimpleIcon as Edit2,
  PackageIcon as Package,
  ArrowCounterClockwiseIcon as RotateCcw,
} from '@phosphor-icons/react';
import {
  useHostTransactions,
  useHostAccounts,
  useHostCategories,
  useHostTransactionActions,
  usePluginNavigation,
  useSubPage,
  centsToYuan,
  yuanToCents,
  toast,
  confirmAction,
  PaperButton,
  PageHeader,
  PaperIconButton,
} from '../../../plugin-sdk';
import { getOwnedItemExt } from '../types';
import type { Transaction } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { computeItemMetrics, isItemDisposed } from '../domain/itemCalculator';
import { ItemSummaryStub } from './ItemSummaryStub';
import { ItemBillPanel } from './ItemBillPanel';
import { ItemDisposePanel } from './ItemDisposePanel';
import { ItemTimelineList } from './ItemTimelineList';

function matchesBillQuery(
  tx: Transaction,
  q: string,
  hostCategories: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string }>
): boolean {
  if (!q) return true;
  const cat = hostCategories.find((c) => c.id === tx.categoryId);
  const acct = accounts.find((a) => a.id === tx.accountId);
  if (tx.note?.toLowerCase().includes(q)) return true;
  if (cat?.name.toLowerCase().includes(q)) return true;
  if (acct?.name.toLowerCase().includes(q)) return true;
  if (centsToYuan(tx.amount).includes(q)) return true;
  return false;
}

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
  const subPage = useSubPage();

  const [isDisposePanelOpen, setIsDisposePanelOpen] = useState(false);
  const [dispositionMode, setDispositionMode] = useState<'sold' | 'idle' | 'gifted' | 'scrapped'>('sold');
  const [sellSource, setSellSource] = useState<'new' | 'existing'>('new');
  const [selectedIncomeTxId, setSelectedIncomeTxId] = useState<string>('');
  const [sellPriceYuan, setSellPriceYuan] = useState('');
  const [sellAccountId, setSellAccountId] = useState(accounts[0]?.id || '');
  const [disposeDate, setDisposeDate] = useState(new Date().toISOString().split('T')[0]);
  const [disposeNote, setDisposeNote] = useState('');
  const [isSubmittingDispose, setIsSubmittingDispose] = useState(false);
  const isSubmittingDisposeRef = useRef(false);

  const [isBillPanelOpen, setIsBillPanelOpen] = useState(false);
  const [billRole, setBillRole] = useState<'maintenance' | 'profit'>('maintenance');
  const [billSource, setBillSource] = useState<'existing' | 'new'>('existing');
  const [searchBillQuery, setSearchBillQuery] = useState('');
  const [billPriceYuan, setBillPriceYuan] = useState('');
  const [billAccountId, setBillAccountId] = useState(accounts[0]?.id || '');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNote, setBillNote] = useState('');
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);
  const isSubmittingBillRef = useRef(false);

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

  const candidateIncomeTxs = useMemo(() => {
    const unlinked = transactions
      .filter(
        (t) =>
          t.type === 'income' &&
          !t.offsetTransactionId &&
          !getOwnedItemExt(t.ext)?.itemId
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const q = searchBillQuery.trim().toLowerCase();
    if (!q) return unlinked.slice(0, 30);
    return unlinked.filter((t) => matchesBillQuery(t, q, hostCategories, accounts)).slice(0, 50);
  }, [transactions, searchBillQuery, hostCategories, accounts]);

  const candidateExpenses = useMemo(() => {
    const unlinked = transactions.filter((t) => t.type === 'expense' && !linkedTxIds.has(t.id));
    const q = searchBillQuery.trim().toLowerCase();
    if (!q) {
      return unlinked.slice(0, 30);
    }
    return unlinked.filter((t) => matchesBillQuery(t, q, hostCategories, accounts)).slice(0, 50);
  }, [transactions, linkedTxIds, searchBillQuery, hostCategories, accounts]);

  const handleLinkTransaction = async (tx: Transaction) => {
    if (!item) return;
    let role: 'buy' | 'maintenance' | 'profit' = billRole === 'profit' ? 'profit' : 'maintenance';
    if (tx.type === 'expense') {
      const hasBuy = itemTransactions.some((t) => getOwnedItemExt(t.ext)?.itemRole === 'buy');
      if (!hasBuy && (!item.kind || item.kind === 'physical')) {
        const asBuy = await confirmAction({
          title: '选择关联角色',
          message: `是否将这笔「¥${centsToYuan(tx.amount)}」设为「${item.name}」的【初始购入账单】？（点击取消则作为配件支出）`,
          confirmText: '设为初始购入',
          cancelText: '作为配件支出',
          isDestructive: false,
        });
        role = asBuy ? 'buy' : 'maintenance';
      } else {
        role = 'maintenance';
      }
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
      setIsBillPanelOpen(false);
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

  const handleConfirmDispose = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmittingDisposeRef.current) return;

    if (dispositionMode === 'sold' && sellSource === 'existing') {
      const targetTx = candidateIncomeTxs.find((t) => t.id === selectedIncomeTxId);
      if (!targetTx) {
        toast.error('请选择要关联的收入记录');
        return;
      }
      isSubmittingDisposeRef.current = true;
      setIsSubmittingDispose(true);
      try {
        await updateTransaction(targetTx.id, {
          ext: {
            ...(targetTx.ext || {}),
            'owned-items': {
              itemId: item.id,
              itemRole: 'sell',
              kind: item.kind,
            },
          },
        });
        await changeStatus(item.id, 'sold', targetTx.date);
        setIsDisposePanelOpen(false);
        setSelectedIncomeTxId('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '关联失败');
      } finally {
        isSubmittingDisposeRef.current = false;
        setIsSubmittingDispose(false);
      }
      return;
    }

    if (dispositionMode === 'sold') {
      const priceNum = parseFloat(sellPriceYuan);
      if (isNaN(priceNum) || priceNum < 0) {
        toast.error('请输入有效的金额');
        return;
      }
      if (!sellAccountId) {
        toast.error('请选择入账账户');
        return;
      }

      isSubmittingDisposeRef.current = true;
      setIsSubmittingDispose(true);
      try {
        await recordTransaction({
          type: 'income',
          amount: yuanToCents(priceNum),
          accountId: sellAccountId,
          categoryId: 'cat_shop',
          date: disposeDate,
          note: disposeNote.trim() || `二手售出: ${item.name}`,
          ext: {
            'owned-items': {
              itemId: item.id,
              itemRole: 'sell',
              kind: item.kind,
            },
          },
        });
        await changeStatus(item.id, 'sold', disposeDate);
        setIsDisposePanelOpen(false);
        setSellPriceYuan('');
        setDisposeNote('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '记录失败');
      } finally {
        isSubmittingDisposeRef.current = false;
        setIsSubmittingDispose(false);
      }
      return;
    }

    isSubmittingDisposeRef.current = true;
    setIsSubmittingDispose(true);
    try {
      if (disposeNote.trim()) {
        await updateItem(item.id, { note: disposeNote.trim() });
      }
      await changeStatus(item.id, dispositionMode, disposeDate);
      setIsDisposePanelOpen(false);
      setDisposeNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      isSubmittingDisposeRef.current = false;
      setIsSubmittingDispose(false);
    }
  };

  const handleConfirmBill = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmittingBillRef.current) return;
    const priceNum = parseFloat(billPriceYuan);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('请输入有效的金额');
      return;
    }
    const isProfit = !isSub && billRole === 'profit';
    if (!billAccountId) {
      toast.error(isProfit ? '请选择入账账户' : '请选择支出账户');
      return;
    }

    const defaultExpenseNote = isSub ? `订阅续费: ${item.name}` : `配件支出: ${item.name}`;
    const defaultNote = isProfit ? `物品收益: ${item.name}` : defaultExpenseNote;

    isSubmittingBillRef.current = true;
    setIsSubmittingBill(true);
    try {
      await recordTransaction({
        type: isProfit ? 'income' : 'expense',
        amount: yuanToCents(priceNum),
        accountId: billAccountId,
        categoryId: isSub ? 'cat_digital' : 'cat_shop',
        date: billDate,
        note: billNote.trim() || defaultNote,
        ext: {
          'owned-items': {
            itemId: item.id,
            itemRole: isProfit ? 'profit' : 'maintenance',
            kind: item.kind,
          },
        },
      });

      setIsBillPanelOpen(false);
      setBillPriceYuan('');
      setBillNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录失败');
    } finally {
      isSubmittingBillRef.current = false;
      setIsSubmittingBill(false);
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
      title: '确认退订',
      message: `确定将「${item.name}」标记为已退吗？`,
      confirmText: '退订',
      isDestructive: false,
    });
    if (!confirmed) return;

    try {
      await changeStatus(item.id, 'sold', today);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '退订失败');
    }
  };

  const handleResumeItem = async () => {
    try {
      await changeStatus(item.id, 'using', undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const openDisposePanel = () => {
    setDispositionMode('sold');
    setSellSource('new');
    setSelectedIncomeTxId('');
    setSearchBillQuery('');
    setIsDisposePanelOpen((prev) => !prev);
    setIsBillPanelOpen(false);
  };

  const openBillPanel = () => {
    if (isSub && item.renewalAmountCents && !billPriceYuan) {
      setBillPriceYuan(centsToYuan(item.renewalAmountCents));
    }
    if (isSub) {
      setBillRole('maintenance');
    }
    setSearchBillQuery('');
    setIsBillPanelOpen((prev) => !prev);
    setIsDisposePanelOpen(false);
  };

  const renderActionButtons = () => {
    if (isSub) {
      return (
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<Plus className="size-3.5 stroke-2 text-(--color-expense)" />}
            onClick={openBillPanel}
          >
            续费
          </PaperButton>

          {item.status === 'using' ? (
            <PaperButton
              variant="secondary"
              size="compact"
              onClick={handleCancelSubscription}
            >
              退订
            </PaperButton>
          ) : (
            <PaperButton
              variant="income"
              size="compact"
              leftIcon={<RotateCcw className="size-3.5 stroke-2" />}
              onClick={handleResumeItem}
            >
              续订
            </PaperButton>
          )}
        </div>
      );
    }

    const disposed = isItemDisposed(item.status);

    if (disposed) {
      return (
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<Plus className="size-3.5 stroke-2 text-(--ink-secondary)" />}
            onClick={openBillPanel}
          >
            关联账单
          </PaperButton>

          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<RotateCcw className="size-3.5 stroke-2" />}
            onClick={handleResumeItem}
          >
            恢复
          </PaperButton>
        </div>
      );
    }

    if (item.status === 'idle') {
      return (
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<Plus className="size-3.5 stroke-2 text-(--ink-secondary)" />}
            onClick={openBillPanel}
          >
            关联账单
          </PaperButton>

          <PaperButton
            variant="secondary"
            size="compact"
            leftIcon={<Package className="size-3.5 stroke-2 text-(--ink-secondary)" />}
            onClick={openDisposePanel}
          >
            处置
          </PaperButton>

          <PaperButton
            variant="income"
            size="compact"
            leftIcon={<RotateCcw className="size-3.5 stroke-2" />}
            onClick={handleResumeItem}
          >
            恢复
          </PaperButton>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <PaperButton
          variant="secondary"
          size="compact"
          leftIcon={<Plus className="size-3.5 stroke-2 text-(--ink-secondary)" />}
          onClick={openBillPanel}
        >
          关联账单
        </PaperButton>

        <PaperButton
          variant="secondary"
          size="compact"
          leftIcon={<Package className="size-3.5 stroke-2 text-(--ink-secondary)" />}
          onClick={openDisposePanel}
        >
          处置
        </PaperButton>
      </div>
    );
  };

  return (
    <div className="w-full pb-20 select-none">
      <PageHeader
        title={isSub ? '订阅详情' : '物品详情'}
        onDoubleClick={() => subPage?.scrollToTop?.()}
        leftAction={
          <PaperIconButton
            icon={ChevronLeft}
            size="md"
            variant="surface"
            onClick={() => (subPage ? subPage.requestClose() : onClose())}
            aria-label="返回清单"
          />
        }
        rightAction={
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
        }
      />

      <div className="space-y-4 px-4 pt-3.5">
        <ItemSummaryStub
          item={item}
          isSub={isSub}
          metrics={metrics}
          transactionCount={itemTransactions.length}
        />

        {renderActionButtons()}

        {isBillPanelOpen && (
          <ItemBillPanel
            isSub={isSub}
            billRole={billRole}
            onChangeBillRole={setBillRole}
            billSource={billSource}
            onChangeBillSource={setBillSource}
            searchBillQuery={searchBillQuery}
            onChangeSearchBillQuery={setSearchBillQuery}
            candidateExpenses={candidateExpenses}
            candidateIncomeTxs={candidateIncomeTxs}
            accounts={accounts}
            hostCategories={hostCategories}
            billPriceYuan={billPriceYuan}
            onChangeBillPriceYuan={setBillPriceYuan}
            billAccountId={billAccountId}
            onChangeBillAccountId={setBillAccountId}
            billDate={billDate}
            onChangeBillDate={setBillDate}
            billNote={billNote}
            onChangeBillNote={setBillNote}
            isSubmittingBill={isSubmittingBill}
            onLinkTransaction={handleLinkTransaction}
            onSubmitNewBill={handleConfirmBill}
            onClose={() => setIsBillPanelOpen(false)}
          />
        )}

        {isDisposePanelOpen && (
          <ItemDisposePanel
            dispositionMode={dispositionMode}
            onChangeDispositionMode={setDispositionMode}
            sellSource={sellSource}
            onChangeSellSource={setSellSource}
            candidateIncomeTxs={candidateIncomeTxs}
            selectedIncomeTxId={selectedIncomeTxId}
            onSelectIncomeTxId={setSelectedIncomeTxId}
            sellPriceYuan={sellPriceYuan}
            onChangeSellPriceYuan={setSellPriceYuan}
            sellAccountId={sellAccountId}
            onChangeSellAccountId={setSellAccountId}
            accounts={accounts}
            disposeDate={disposeDate}
            onChangeDisposeDate={setDisposeDate}
            disposeNote={disposeNote}
            onChangeDisposeNote={setDisposeNote}
            isSubmittingDispose={isSubmittingDispose}
            onSubmit={handleConfirmDispose}
            onClose={() => setIsDisposePanelOpen(false)}
          />
        )}

        <ItemTimelineList
          isSub={isSub}
          transactions={itemTransactions}
          onUnlinkTransaction={handleUnlinkTransaction}
        />
      </div>
    </div>
  );
};
