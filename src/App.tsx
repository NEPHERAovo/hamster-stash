import { useEffect, useState, useRef, useMemo } from 'react';
import { GearIcon as Settings, PencilSimpleIcon as Pencil } from '@phosphor-icons/react';
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
import { DataManageSubPage } from './components/assets/DataManageSubPage';
import { ImportSubPage } from './components/assets/ImportSubPage';
import { LoanChainModal } from './components/assets/LoanChainModal';
import { ReconcileModal } from './components/assets/ReconcileModal';
import { CreateAccountModal } from './components/assets/CreateAccountModal';
import { TransferModal } from './components/assets/TransferModal';
import { Toast } from './components/ui/Toast';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { PwaUpdateBanner } from './components/ui/PwaUpdateBanner';
import { PaperButton } from './components/ui/PaperButton';
import { PaperIconButton } from './components/ui/PaperIconButton';
import { PaperChip } from './components/ui/PaperChip';
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
import { currentYearMonth, stepYearMonth } from './utils/date';
import { isSandboxModeActive, setSandboxMode, resetSandboxData } from './core/db/schema';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('ledger');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoanHubOpen, setIsLoanHubOpen] = useState(false);
  const [activeDetailAccount, setActiveDetailAccount] = useState<Account | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [isDataManageOpen, setIsDataManageOpen] = useState(false);
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
    () => displayTransactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(currentMonth)),
    [displayTransactions, currentMonth]
  );

  const displayMonthSummary = useMemo(() => {
    return computeMonthSummary(currentMonthTransactions, displayTransactions);
  }, [currentMonthTransactions, displayTransactions]);

  const renderHeader = () => {
    if (currentTab === 'ledger') {
      return (
        <PageHeader
          title={folioMonthTitle}
          showMonthStep={true}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
          showBackToToday={!isCurrentNaturalMonth}
          onBackToToday={jumpToCurrentMonth}
        />
      );
    }

    if (currentTab === 'stats') {
      const modeLabels: Record<'week' | 'month' | 'year', string> = {
        week: '周',
        month: '月',
        year: '年',
      };
      return (
        <PageHeader
          title={isModern ? '统计' : 'Statistics'}
          rightAction={
            <div className="flex items-center gap-1">
              {(['week', 'month', 'year'] as const).map((m) => (
                <PaperChip
                  key={m}
                  size="sm"
                  selected={statsMode === m}
                  onClick={() => setStatsMode(m)}
                >
                  {modeLabels[m]}
                </PaperChip>
              ))}
            </div>
          }
        />
      );
    }

    if (activeNavTab) {
      let pageTitle = activeNavTab.label;
      if (activeNavTab.id === 'items') {
        pageTitle = isModern ? '物品' : 'Owned Items';
      }
      return (
        <PageHeader
          title={pageTitle}
        />
      );
    }

    return (
      <PageHeader
        title={isModern ? '资产' : 'Assets'}
        rightAction={
          <PaperIconButton
            icon={Settings}
            size="md"
            variant="surface"
            onClick={() => setIsSettingsOpen(true)}
            title="设置"
            aria-label="设置"
          />
        }
      />
    );
  };

  return (
    <AppShell>
      {isSandboxModeActive() && (
        <div className="flex w-full items-center justify-between border-b border-(--color-accent)/30 bg-(--color-accent)/10 px-3.5 py-1.5 font-mono text-xs text-(--ink-primary) select-none">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-(--color-accent)" />
            <span className="truncate font-medium">测试沙盒 (与真实数据隔离)</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PaperButton
              variant="secondary"
              size="xs"
              onClick={() => void resetSandboxData()}
            >
              重置
            </PaperButton>
            <PaperButton
              variant="primary"
              size="xs"
              onClick={() => setSandboxMode(false)}
            >
              退出测试
            </PaperButton>
          </div>
        </div>
      )}
      <div key={currentTab === 'ledger' ? `${currentTab}-${currentMonth}` : currentTab} className="tab-header-enter w-full">
        {renderHeader()}
      </div>

      <main
        ref={mainScrollRef}
        className="main-scroll-content min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-0 pb-[calc(76px+var(--dock-bottom))]"
      >
        <div key={currentTab === 'ledger' ? `${currentTab}-${currentMonth}` : currentTab} className="tab-page-enter w-full">
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
                <PaperButton
                  variant="secondary"
                  size="compact"
                  leftIcon={<Pencil className="size-3.5" />}
                  onClick={() => setEditingAccount(currentDetailAccount)}
                  title="编辑账户"
                >
                  编辑
                </PaperButton>
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
            onToggleAutoRepay={async (acct, nextValue) => {
              await updateAccount(acct.id, { autoRepay: nextValue });
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
          onOpenDataManage={() => setIsDataManageOpen(true)}
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
        isOpen={isDataManageOpen}
        onClose={() => setIsDataManageOpen(false)}
        className="z-50"
        header={
          <PageHeader
            title="数据与备份"
            centerTitle={true}
            leftAction={<SubPageBackButton label="设置" />}
          />
        }
      >
        <DataManageSubPage
          onOpenImport={() => setIsImportOpen(true)}
        />
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
          showAddButton={currentTab === 'ledger' || currentTab === 'items' || currentTab === 'assets'}
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
            if (currentTab === 'ledger') {
              setEditingTx(null);
              setIsAddOpen((prev) => !prev);
            } else if (currentTab === 'items') {
              usePluginUIStore.getState().openModal('item-form');
            } else if (currentTab === 'assets') {
              handleCreateNewAccount();
            }
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
        onSelectTransaction={handleSelectTransaction}
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
        accounts={accounts}
        onClose={() => {
          setIsCreateAccountOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={async (input) => {
          await createAccount(input);
          if (input.initialBalance && input.initialBalance !== 0) {
            await loadTransactions();
          }
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
