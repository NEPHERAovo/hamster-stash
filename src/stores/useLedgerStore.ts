import { create } from 'zustand';
import type { Transaction } from '../types/transaction';
import { core } from '../core';
import {
  computeMonthSummary,
  type MonthSummary,
} from '../domain/finance/balanceCalculator';
import type {
  CreateTransactionInput,
  ReconcileInput,
  PendingSettlementSummary,
} from '../domain/transaction/transactionService';
import { useAccountStore } from './useAccountStore';
import { usePreferenceStore } from './usePreferenceStore';
import { currentYearMonth } from '../utils/date';

interface LedgerState {
  currentMonth: string; // YYYY-MM
  transactions: Transaction[];
  summary: MonthSummary;
  settlementSummary: PendingSettlementSummary;
  loading: boolean;
  isInitialLoaded: boolean;
  setCurrentMonth: (month: string) => void;
  loadTransactions: () => Promise<void>;
  loadMonth: (month?: string) => Promise<void>;
  loadSettlementSummary: () => Promise<void>;
  recordTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<CreateTransactionInput>) => Promise<Transaction>;
  reconcileAccount: (input: ReconcileInput) => Promise<void>;
  settleReimbursement: (txId: string, toAccountId: string) => Promise<void>;
  settleLoanOrigin: (originLoanId: string, settleAccountId: string) => Promise<void>;
  importTransactions: (
    records: {
      id?: string;
      type: Transaction['type'];
      amount: number;
      date: string;
      createdAt?: string;
      categoryId: string;
      accountId: string;
      note?: string;
      isReimbursable?: boolean;
      ext?: Record<string, unknown>;
    }[],
    syncAccountBalance?: boolean
  ) => Promise<{ importedCount: number }>;
}

const initialSettlementSummary: PendingSettlementSummary = {
  lendPendingAmount: 0,
  reimbPendingAmount: 0,
  borrowPendingAmount: 0,
  installmentPendingAmount: 0,
  netPendingAmount: 0,
  pendingLoans: [],
  pendingReimbursements: [],
  pendingInstallments: [],
};

export const useLedgerStore = create<LedgerState>((set, get) => ({
  currentMonth: currentYearMonth(),
  transactions: [],
  summary: { totalIncome: 0, totalExpense: 0, netBalance: 0, retentionRate: 0 },
  settlementSummary: initialSettlementSummary,
  loading: false,
  isInitialLoaded: false,

  setCurrentMonth: (month: string) => {
    set({ currentMonth: month });
    get().loadMonth(month);
  },

  loadSettlementSummary: async () => {
    await core.init();
    const settlementSummary = await core.txService.getPendingSettlementSummary();
    set({ settlementSummary });
  },

  loadTransactions: async () => {
    set({ loading: true });
    await core.init();

    const all = await core.txService.listTransactions();
    const currentMonth = get().currentMonth || currentYearMonth();
    const monthTxs = all.filter((t) => typeof t.date === 'string' && t.date.startsWith(currentMonth));
    const accounts = useAccountStore.getState().accounts;
    const includedAccountIds = accounts.length > 0
      ? new Set(accounts.filter((a) => !a.isArchived && a.includeInNetWorth !== false).map((a) => a.id))
      : undefined;
    const isAmortizationEnabled = usePreferenceStore.getState().isAmortizationEnabled;
    const summary = computeMonthSummary(monthTxs, all, {
      includedAccountIds,
      currentMonth,
      isAmortizationEnabled,
    });
    const settlementSummary = await core.txService.getPendingSettlementSummary(all);

    set({
      transactions: all,
      summary,
      settlementSummary,
      loading: false,
      isInitialLoaded: true,
    });
  },

  loadMonth: async (targetMonth?: string) => {
    const month = targetMonth || get().currentMonth;
    set({ loading: true });
    await core.init();

    const all = await core.txService.listTransactions();
    const monthTxs = all.filter((tx) => typeof tx.date === 'string' && tx.date.startsWith(month));
    const accounts = useAccountStore.getState().accounts;
    const includedAccountIds = accounts.length > 0
      ? new Set(accounts.filter((a) => !a.isArchived && a.includeInNetWorth !== false).map((a) => a.id))
      : undefined;
    const isAmortizationEnabled = usePreferenceStore.getState().isAmortizationEnabled;
    const summary = computeMonthSummary(monthTxs, all, {
      includedAccountIds,
      currentMonth: month,
      isAmortizationEnabled,
    });
    const settlementSummary = await core.txService.getPendingSettlementSummary(all);

    set({
      currentMonth: month,
      transactions: all,
      summary,
      settlementSummary,
      loading: false,
      isInitialLoaded: true,
    });
  },

  recordTransaction: async (input) => {
    await core.init();
    const tx = await core.txService.recordTransaction(input);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();

    return tx;
  },

  deleteTransaction: async (id) => {
    await core.init();
    await core.txService.deleteTransaction(id);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();
  },

  updateTransaction: async (id, patch) => {
    await core.init();
    const updated = await core.txService.updateTransaction(id, patch);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();

    return updated;
  },

  reconcileAccount: async (input) => {
    await core.init();
    await core.txService.reconcileAccount(input);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();
  },

  settleReimbursement: async (txId, toAccountId) => {
    await core.init();
    await core.txService.settleReimbursement(txId, toAccountId);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();
  },

  settleLoanOrigin: async (originLoanId, settleAccountId) => {
    await core.init();
    await core.txService.settleLoanOrigin(originLoanId, settleAccountId);

    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();
  },

  importTransactions: async (records, syncAccountBalance = true) => {
    await core.init();
    const res = await core.txService.importTransactions(records, syncAccountBalance);
    await get().loadTransactions();
    await useAccountStore.getState().loadAccounts();
    return res;
  },
}));
