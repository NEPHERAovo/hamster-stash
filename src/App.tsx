import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Settings, Pencil, ArrowLeftRight } from 'lucide-react';
import {
  AppShell,
  PageHeader,
  BottomNav,
  SubPageShell,
  SubPageBackButton,
  type NavTab,
} from './components/layout';
import { BalanceSummaryCard } from './components/ledger/BalanceSummaryCard';
import { TransactionGroup } from './components/ledger/TransactionGroup';
import { AddTransactionModal } from './components/ledger/AddTransactionModal';
import {
  StatsView,
  CategoryDetailSubPage,
  type CategoryDrilldownData,
} from './components/stats';
import { NetWorthHeader } from './components/assets/NetWorthHeader';
import { AccountList } from './components/assets/AccountList';
import { AccountDetailSubPage } from './components/assets/AccountDetailSubPage';
import { SettingsSubPage } from './components/assets/SettingsSubPage';
import { CategoryManageSubPage } from './components/assets/CategoryManageSubPage';
import { ImportSubPage } from './components/assets/ImportSubPage';
import { LoanChainModal } from './components/assets/LoanChainModal';
import { ReconcileModal } from './components/assets/ReconcileModal';
import { CreateAccountModal } from './components/assets/CreateAccountModal';
import { TransferModal } from './components/assets/TransferModal';
import { Toast } from './components/ui/Toast';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { PwaUpdateBanner } from './components/ui/PwaUpdateBanner';
import { toast } from './stores/useToastStore';
import { useLedgerStore } from './stores/useLedgerStore';
import { useAccountStore } from './stores/useAccountStore';
import { useCategoryStore } from './stores/useCategoryStore';
import { useThemeStore } from './stores/useThemeStore';
import { usePreferenceStore } from './stores/usePreferenceStore';
import { computeMonthSummary } from './domain/finance/balanceCalculator';
import type { PeriodMode } from './domain/finance/periodStats';
import type { Account } from './types/account';
import type { Transaction } from './types/transaction';
import { usePluginUIStore } from './core/plugin/SlotStore';
import { PluginSubPageOutlet } from './plugin-sdk/components/PluginSubPageOutlet';
import { PluginModalOutlet } from './plugin-sdk/components/PluginModalOutlet';
import { pluginManager } from './core/plugin/PluginManager';
import { syncService } from './domain/sync/syncService';
import { cn } from './utils/cn';
import { currentYearMonth, stepYearMonth } from './utils/date';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('ledger');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoanHubOpen, setIsLoanHubOpen] = useState(false);
  const [activeDetailAccount, setActiveDetailAccount] = useState<Account | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reconcileAccount, setReconcileAccount] = useState<Account | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingTransferTx, setEditingTransferTx] = useState<Transaction | null>(null);
  const [transferDefaultFromId, setTransferDefaultFromId] = useState<string | undefined>(undefined);
  const [freshTxId, setFreshTxId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [statsMode, setStatsMode] = useState<PeriodMode>('month');
  const [activeCategoryDrilldown, setActiveCategoryDrilldown] = useState<CategoryDrilldownData | null>(null);

  const handleSelectTransaction = (tx: Transaction) => {
    if (tx.type === 'transfer') {
      setEditingTransferTx(tx);
      setTransferDefaultFromId(undefined);
      setIsTransferOpen(true);
    } else if (tx.type === 'reconcile') {
      const acct = accounts.find((a) => a.id === tx.accountId) || null;
      if (acct) setReconcileAccount(acct);
    } else {
      setEditingTx(tx);
      setIsAddOpen(true);
    }
  };

  const mainScrollRef = useRef<HTMLDivElement>(null);

  const { isDark, toggleDark, uiStyle } = useThemeStore();
  const isModern = uiStyle === 'modern';

  const {
    currentMonth,
    setCurrentMonth,
    loadMonth,
    transactions,
    allTransactions,
    settlementSummary,
    loadTransactions,
    loadSettlementSummary,
  } = useLedgerStore();

  const { accounts, loadAccounts, createAccount, updateAccount, deleteAccount } = useAccountStore();
  const { categories, loadCategories } = useCategoryStore();

  const todayMonth = currentYearMonth();

  const isCurrentNaturalMonth = currentMonth === todayMonth;

  const stepMonth = (offset: number) => {
    const nextMonth = stepYearMonth(currentMonth, offset);
    setCurrentMonth(nextMonth);
    loadMonth(nextMonth);
  };

  const jumpToCurrentMonth = () => {
    setCurrentMonth(todayMonth);
    loadMonth(todayMonth);
  };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const SHORT_MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [currentYearNum, currentMonthNum] = currentMonth.split('-').map(Number);
  const currentMonthName = MONTH_NAMES[(currentMonthNum || 1) - 1] || `${currentMonthNum}月`;
  const shortMonthName = SHORT_MONTH_NAMES[(currentMonthNum || 1) - 1] || `${currentMonthNum}月`;
  const folioMonthTitle = isModern
    ? `${shortMonthName}, ${currentYearNum}`
    : `${currentMonthName} ${currentYearNum}`;

  useEffect(() => {
    loadAccounts();
    loadCategories();
    loadTransactions();
    loadSettlementSummary();
    pluginManager.init();
    void useThemeStore.getState().loadThemeFromDB();
    void usePreferenceStore.getState().loadPreferencesFromDB();

    const triggerDailySync = () => {
      void syncService
        .runAutoSyncIfNeeded({
          onStart: () => {
            toast.info('正在进行今日 WebDAV 自动备份...');
          },
        })
        .then((result) => {
          if (!result.ran) return;
          if (result.success) {
            if (result.changedLocal) {
              void Promise.all([
                loadAccounts(),
                loadCategories(),
                loadTransactions(),
                loadSettlementSummary(),
                useThemeStore.getState().loadThemeFromDB(),
              ]);
            }
            const attHint =
              result.uploadedAttachments && result.uploadedAttachments > 0
                ? `（含 ${result.uploadedAttachments} 个凭证附件）`
                : '';
            toast.success(`今日数据已自动备份至云端${attHint}`);
          } else {
            toast.warning('今日自动备份失败，请检查网络或 WebDAV 配置');
          }
        });
    };

    triggerDailySync();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerDailySync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadAccounts, loadCategories, loadTransactions, loadSettlementSummary]);

  const handleCreateNewAccount = () => {
    setIsCreateAccountOpen(true);
  };

  const handleDeleteAccount = async (acct: Account) => {
    try {
      await deleteAccount(acct.id, true);
      await loadTransactions();
      await loadSettlementSummary();
      setActiveDetailAccount(null);
      toast.success(`已删除账户「${acct.name}」`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除账户失败');
    }
  };

  const currentDetailAccount = activeDetailAccount
    ? accounts.find((a) => a.id === activeDetailAccount.id) || activeDetailAccount
    : null;

  const totalNetWorth = accounts.reduce(
    (acc, cur) => acc + (cur.isArchived || cur.includeInNetWorth === false ? 0 : cur.balance),
    0
  );

  const pluginNavTabs = usePluginUIStore((s) => s.navTabs);

  useEffect(() => {
    const isBuiltinTab = ['ledger', 'stats', 'assets'].includes(currentTab);
    const isPluginTab = pluginNavTabs.some((t) => t.id === currentTab);
    if (!isBuiltinTab && !isPluginTab) {
      setCurrentTab('ledger');
    }
  }, [currentTab, pluginNavTabs]);

  const activeNavTab = pluginNavTabs.find((t) => t.id === currentTab);

  const displayTransactions = allTransactions.length > 0 ? allTransactions : transactions;

  const currentMonthTransactions = useMemo(
    () => displayTransactions.filter((t) => t.date.startsWith(currentMonth)),
    [displayTransactions, currentMonth]
  );

  const displayMonthSummary = useMemo(() => {
    return computeMonthSummary(currentMonthTransactions, displayTransactions);
  }, [currentMonthTransactions, displayTransactions]);

  return (
    <AppShell>
      <div key={currentTab} className="tab-header-enter w-full">
        {currentTab === 'ledger' ? (
          <PageHeader
            title={folioMonthTitle}
            showMonthStep={true}
            onPrevMonth={() => stepMonth(-1)}
            onNextMonth={() => stepMonth(1)}
            showBackToToday={!isCurrentNaturalMonth}
            onBackToToday={jumpToCurrentMonth}
          />
        ) : currentTab === 'stats' ? (
          <PageHeader
            title={isModern ? '统计' : 'Statistics'}
            rightAction={
              <div className="flex items-center gap-1 font-mono text-xs select-none">
                {(['week', 'month', 'year'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStatsMode(m)}
                    className={cn(
                      'relative px-2 py-1 text-xs transition-colors cursor-pointer',
                      statsMode === m
                        ? 'font-bold text-(--ink-solid)'
                        : 'text-(--ink-tertiary) hover:text-(--ink-primary)'
                    )}
                  >
                    <span>{m === 'week' ? '周' : m === 'month' ? '月' : '年'}</span>
                    {statsMode === m && (
                      <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-(--ink-solid) rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            }
          />
        ) : activeNavTab ? (
          <PageHeader
            title={activeNavTab.id === 'items' ? (isModern ? '物品' : 'Owned Items') : activeNavTab.label}
            rightAction={
              activeNavTab.id === 'items' ? (
                <button
                  type="button"
                  onClick={() => usePluginUIStore.getState().openModal('item-form')}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
                  title="新增物品"
                >
                  <Plus className="w-3.5 h-3.5 stroke-2" />
                  <span>新建</span>
                </button>
              ) : undefined
            }
          />
        ) : (
          <PageHeader
            title={isModern ? '资产' : 'Assets'}
            rightAction={
              <div className="flex items-center gap-1.5">
                {accounts.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTransferTx(null);
                      setTransferDefaultFromId(undefined);
                      setIsTransferOpen(true);
                    }}
                    className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
                    title="资金划转"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.8]" />
                    <span>划转</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer"
                  title="设置"
                >
                  <Settings className="w-3.5 h-3.5 stroke-[1.8]" />
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewAccount}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
                  title="新增资金账户"
                >
                  <Plus className="w-3.5 h-3.5 stroke-2" />
                  <span>新建</span>
                </button>
              </div>
            }
          />
        )}
      </div>

      <main
        ref={mainScrollRef}
        className="flex-1 w-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-0 pb-[calc(76px+var(--dock-bottom))] main-scroll-content"
      >
        <div key={currentTab} className="tab-page-enter w-full">
          {currentTab === 'ledger' && (
            <div className="w-full">
              <div className="tab-stagger-1 w-full">
                <BalanceSummaryCard
                  summary={displayMonthSummary}
                  monthStr={currentMonth}
                />
              </div>

              <div className="tab-stagger-2 w-full">
                <TransactionGroup
                  transactions={currentMonthTransactions}
                  searchTransactions={displayTransactions}
                  categories={categories}
                  accounts={accounts}
                  pageSize={15}
                  freshTxId={freshTxId}
                  onSelectTransaction={handleSelectTransaction}
                />
              </div>
            </div>
          )}

          {currentTab === 'stats' && (
            <div className="w-full px-4">
              <StatsView
                allTransactions={displayTransactions}
                categories={categories}
                accounts={accounts}
                mode={statsMode}
                onModeChange={setStatsMode}
                onOpenCategoryDrilldown={setActiveCategoryDrilldown}
                onSelectTransaction={handleSelectTransaction}
              />
            </div>
          )}

          {activeNavTab && (
            <div className="w-full">
              <activeNavTab.component />
            </div>
          )}

          {currentTab === 'assets' && (
            <div className="w-full">
              <div className="space-y-3.5 px-4 pt-2">
                <div className="tab-stagger-1 w-full">
                  <NetWorthHeader
                    netWorthCents={totalNetWorth}
                    summary={settlementSummary}
                    onClickLoanHub={() => setIsLoanHubOpen(true)}
                  />
                </div>

                <div className="tab-stagger-2 w-full">
                  <AccountList
                    accounts={accounts}
                    onSelectAccount={(acct) => setActiveDetailAccount(acct)}
                    onDeleteAccount={handleDeleteAccount}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <SubPageShell
        isOpen={Boolean(currentDetailAccount)}
        onClose={() => setActiveDetailAccount(null)}
        header={
          <PageHeader
            title={currentDetailAccount?.name || ''}
            centerTitle={true}
            leftAction={<SubPageBackButton label="资产" />}
            rightAction={
              currentDetailAccount ? (
                <button
                  type="button"
                  onClick={() => setEditingAccount(currentDetailAccount)}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
                  title="编辑账户"
                >
                  <Pencil className="w-3.5 h-3.5 stroke-[1.8]" />
                  <span>编辑</span>
                </button>
              ) : undefined
            }
          />
        }
      >
        {currentDetailAccount && (
          <AccountDetailSubPage
            account={currentDetailAccount}
            transactions={displayTransactions}
            categories={categories}
            accounts={accounts}
            onOpenReconcile={() => setReconcileAccount(currentDetailAccount)}
            onOpenTransfer={(acct) => {
              setEditingTransferTx(null);
              setTransferDefaultFromId(acct.id);
              setIsTransferOpen(true);
            }}
            onToggleIncludeInNetWorth={async (acct, nextValue) => {
              await updateAccount(acct.id, { includeInNetWorth: nextValue });
            }}
            onDeleteAccount={handleDeleteAccount}
            onSelectTransaction={handleSelectTransaction}
          />
        )}
      </SubPageShell>

      <SubPageShell
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        header={
          <PageHeader
            title={isModern ? '设置' : 'Settings'}
            centerTitle={true}
            leftAction={<SubPageBackButton label="资产" />}
          />
        }
      >
        <SettingsSubPage
          onClose={() => setIsSettingsOpen(false)}
          isDark={isDark}
          onToggleDark={toggleDark}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenCategories={() => setIsCategoryManageOpen(true)}
        />
      </SubPageShell>

      <SubPageShell
        isOpen={isCategoryManageOpen}
        onClose={() => setIsCategoryManageOpen(false)}
        className="z-50"
        header={
          <PageHeader
            title="分类管理"
            centerTitle={true}
            leftAction={<SubPageBackButton label="设置" />}
          />
        }
      >
        <CategoryManageSubPage />
      </SubPageShell>

      <SubPageShell
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        className="z-50"
        header={
          <PageHeader
            title="账本导入向导"
            centerTitle={true}
            leftAction={<SubPageBackButton label="返回" />}
          />
        }
      >
        <ImportSubPage
          onClose={() => setIsImportOpen(false)}
          onImportSuccess={() => {
            loadAccounts();
            loadCategories();
            loadTransactions();
            loadSettlementSummary();
          }}
        />
      </SubPageShell>

      <SubPageShell
        isOpen={Boolean(activeCategoryDrilldown)}
        onClose={() => setActiveCategoryDrilldown(null)}
        header={
          <PageHeader
            title={activeCategoryDrilldown?.category.name || '分类明细'}
            centerTitle={true}
            leftAction={<SubPageBackButton label="统计" />}
          />
        }
      >
        {activeCategoryDrilldown && (
          <CategoryDetailSubPage
            data={activeCategoryDrilldown}
            categories={categories}
            accounts={accounts}
            onSelectTransaction={handleSelectTransaction}
          />
        )}
      </SubPageShell>

      {!isSettingsOpen && !isImportOpen && !isCategoryManageOpen && !activeDetailAccount && !activeCategoryDrilldown && (
        <BottomNav
          currentTab={currentTab}
          showAddButton={currentTab === 'ledger'}
          isAddOpen={isAddOpen || Boolean(editingTx)}
          onTabChange={(tab) => {
            if (tab === currentTab) {
              mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              setCurrentTab(tab);
              mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
            }
          }}
          onAddClick={() => {
            setEditingTx(null);
            setIsAddOpen((prev) => !prev);
          }}
        />
      )}

      <AddTransactionModal
        isOpen={isAddOpen || Boolean(editingTx)}
        editingTransaction={editingTx}
        onClose={() => {
          setIsAddOpen(false);
          setEditingTx(null);
        }}
        onSuccess={(newId) => {
          setFreshTxId(newId);
          mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <LoanChainModal
        isOpen={isLoanHubOpen}
        onClose={() => setIsLoanHubOpen(false)}
      />

      <ReconcileModal
        account={reconcileAccount}
        isOpen={Boolean(reconcileAccount)}
        onClose={() => setReconcileAccount(null)}
      />

      <TransferModal
        isOpen={isTransferOpen}
        editingTransaction={editingTransferTx}
        defaultFromAccountId={transferDefaultFromId}
        accounts={accounts}
        onClose={() => {
          setIsTransferOpen(false);
          setEditingTransferTx(null);
          setTransferDefaultFromId(undefined);
        }}
        onConfirm={async (input) => {
          if (editingTransferTx) {
            await useLedgerStore.getState().updateTransaction(editingTransferTx.id, {
              type: 'transfer',
              amount: input.amountCents,
              accountId: input.fromAccountId,
              toAccountId: input.toAccountId,
              date: input.date,
              note: input.note,
              categoryId: 'cat_transfer',
            });
          } else {
            await useLedgerStore.getState().recordTransaction({
              type: 'transfer',
              amount: input.amountCents,
              accountId: input.fromAccountId,
              toAccountId: input.toAccountId,
              date: input.date,
              note: input.note,
              categoryId: 'cat_transfer',
            });
          }
        }}
        onDelete={async (id) => {
          await useLedgerStore.getState().deleteTransaction(id);
        }}
      />

      <CreateAccountModal
        isOpen={isCreateAccountOpen || Boolean(editingAccount)}
        editingAccount={editingAccount}
        onClose={() => {
          setIsCreateAccountOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={async (input) => {
          await createAccount(input);
        }}
        onUpdate={async (id, patch) => {
          await updateAccount(id, patch);
        }}
      />

      <PluginSubPageOutlet />
      <PluginModalOutlet />
      <PwaUpdateBanner />
      <Toast />
      <ConfirmDialog />
    </AppShell>
  );
}

export default App;
