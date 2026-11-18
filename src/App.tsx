import { useEffect, useState, useRef, useMemo } from 'react';
import { ChevronLeft, Plus, Settings, Scale } from 'lucide-react';
import {
  AppShell,
  PageHeader,
  BottomNav,
  type NavTab,
} from './components/layout';
import { BalanceSummaryCard } from './components/ledger/BalanceSummaryCard';
import { TransactionGroup } from './components/ledger/TransactionGroup';
import { AddTransactionModal } from './components/ledger/AddTransactionModal';
import { StatsView } from './components/stats/StatsView';
import { NetWorthHeader } from './components/assets/NetWorthHeader';
import { AccountList } from './components/assets/AccountList';
import { AccountDetailSubPage } from './components/assets/AccountDetailSubPage';
import { SettingsSubPage } from './components/assets/SettingsSubPage';
import { ImportSubPage } from './components/assets/ImportSubPage';
import { LoanChainModal } from './components/assets/LoanChainModal';
import { ReconcileModal } from './components/assets/ReconcileModal';
import { Toast } from './components/ui/Toast';
import { toast } from './stores/useToastStore';
import { useLedgerStore } from './stores/useLedgerStore';
import { useAccountStore } from './stores/useAccountStore';
import { useCategoryStore } from './stores/useCategoryStore';
import { useThemeStore } from './stores/useThemeStore';
import { computeMonthSummary } from './domain/finance/balanceCalculator';
import type { PeriodMode } from './domain/finance/periodStats';
import type { Account } from './types/account';
import type { Transaction } from './types/transaction';
import { usePluginUIStore } from './core/plugin/SlotStore';
import { PluginSubPageOutlet } from './plugin-sdk/components/PluginSubPageOutlet';
import { PluginModalOutlet } from './plugin-sdk/components/PluginModalOutlet';
import { pluginManager } from './core/plugin/PluginManager';
import { cn } from './utils/cn';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('ledger');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoanHubOpen, setIsLoanHubOpen] = useState(false);
  const [activeDetailAccount, setActiveDetailAccount] = useState<Account | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reconcileAccount, setReconcileAccount] = useState<Account | null>(null);
  const [freshTxId, setFreshTxId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [statsMode, setStatsMode] = useState<PeriodMode>('month');

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

  const { accounts, loadAccounts, createAccount, deleteAccount } = useAccountStore();
  const { categories, loadCategories } = useCategoryStore();

  const stepMonth = (offset: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(nextMonth);
    loadMonth(nextMonth);
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
  }, [loadAccounts, loadCategories, loadTransactions, loadSettlementSummary]);

  const handleCreateNewAccount = async () => {
    const name = prompt('请输入新账户名称 (如: 招商银行信用卡、美团钱包等):');
    if (!name || !name.trim()) return;

    try {
      await createAccount({
        name: name.trim(),
        type: 'bank',
        initialBalance: 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建账户失败');
    }
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
    (acc, cur) => acc + (cur.isArchived ? 0 : cur.balance),
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

  const displayMonthSummary = useMemo(() => {
    const monthTxs = displayTransactions.filter((t) => t.date.startsWith(currentMonth));
    return computeMonthSummary(monthTxs, displayTransactions);
  }, [displayTransactions, currentMonth]);

  return (
    <AppShell>
      {isImportOpen ? (
        <PageHeader
          title="账本导入向导"
          centerTitle={true}
          leftAction={
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="flex items-center text-sm font-semibold text-(--ink-secondary) hover:text-(--ink-primary) cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 stroke-2" />
              <span>返回</span>
            </button>
          }
        />
      ) : isSettingsOpen ? (
        <PageHeader
          title={isModern ? '设置' : 'Settings'}
          centerTitle={true}
          leftAction={
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="flex items-center text-sm font-semibold text-(--ink-secondary) hover:text-(--ink-primary) cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 stroke-2" />
              <span>资产</span>
            </button>
          }
        />
      ) : currentDetailAccount ? (
        <PageHeader
          title={currentDetailAccount.name}
          centerTitle={true}
          leftAction={
            <button
              type="button"
              onClick={() => setActiveDetailAccount(null)}
              className="flex items-center text-sm font-semibold text-(--ink-secondary) hover:text-(--ink-primary) cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 stroke-2" />
              <span>资产</span>
            </button>
          }
          rightAction={
            <button
              type="button"
              onClick={() => setReconcileAccount(currentDetailAccount)}
              className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
              title="平账校准"
            >
              <Scale className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>平账</span>
            </button>
          }
        />
      ) : currentTab === 'ledger' ? (
        <PageHeader
          title={folioMonthTitle}
          showMonthStep={true}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
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
          title={activeNavTab.id === 'items' ? (isModern ? '持有物品' : 'Owned Items') : activeNavTab.label}
          rightAction={
            activeNavTab.id === 'items' ? (
              <button
                type="button"
                onClick={() => usePluginUIStore.getState().openModal('item-form')}
                className="h-7 px-2.5 flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all text-xs font-mono cursor-pointer"
                title="新增持有物品"
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

      <main
        ref={mainScrollRef}
        className="flex-1 w-full min-h-0 overflow-y-auto overscroll-contain px-0 py-0 pb-20 main-scroll-content"
      >
        {currentTab === 'ledger' && (
          <div className="w-full">
            <BalanceSummaryCard
              summary={displayMonthSummary}
              monthStr={currentMonth}
            />

            <TransactionGroup
              transactions={displayTransactions}
              categories={categories}
              accounts={accounts}
              pageSize={15}
              freshTxId={freshTxId}
              onSelectTransaction={(tx) => {
                setEditingTx(tx);
                setIsAddOpen(true);
              }}
            />
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
              onSelectTransaction={(tx) => {
                setEditingTx(tx);
                setIsAddOpen(true);
              }}
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
            {isImportOpen ? (
              <ImportSubPage
                onClose={() => setIsImportOpen(false)}
                onImportSuccess={() => {
                  loadAccounts();
                  loadCategories();
                  loadTransactions();
                  loadSettlementSummary();
                }}
              />
            ) : isSettingsOpen ? (
              <SettingsSubPage
                onClose={() => setIsSettingsOpen(false)}
                isDark={isDark}
                onToggleDark={toggleDark}
                onOpenImport={() => setIsImportOpen(true)}
              />
            ) : currentDetailAccount ? (
              <AccountDetailSubPage
                account={currentDetailAccount}
                transactions={displayTransactions}
                categories={categories}
                accounts={accounts}
                onOpenReconcile={() => setReconcileAccount(currentDetailAccount)}
                onDeleteAccount={handleDeleteAccount}
                onSelectTransaction={(tx) => {
                  setEditingTx(tx);
                  setIsAddOpen(true);
                }}
              />
            ) : (
              <div className="space-y-3.5 px-4 pt-2">
                <NetWorthHeader
                  netWorthCents={totalNetWorth}
                  summary={settlementSummary}
                  onClickLoanHub={() => setIsLoanHubOpen(true)}
                />

                <AccountList
                  accounts={accounts}
                  onSelectAccount={(acct) => setActiveDetailAccount(acct)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {!isSettingsOpen && !isImportOpen && !activeDetailAccount && (
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

      <PluginSubPageOutlet />
      <PluginModalOutlet />
      <Toast />
    </AppShell>
  );
}

export default App;
