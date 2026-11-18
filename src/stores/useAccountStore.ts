import { create } from 'zustand';
import type { Account } from '../types/account';
import { core } from '../core';
import type { CreateAccountInput, UpdateAccountInput } from '../domain/account/accountService';

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  loading: boolean;
  loadAccounts: () => Promise<void>;
  createAccount: (input: CreateAccountInput) => Promise<Account>;
  updateAccount: (id: string, patch: UpdateAccountInput) => Promise<Account>;
  deleteAccount: (id: string, force?: boolean) => Promise<void>;
  setActiveAccount: (id: string | null) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  activeAccountId: null,
  loading: false,

  loadAccounts: async () => {
    set({ loading: true });
    await core.init();
    const accounts = await core.acctRepo.findAll();
    set({ accounts, loading: false });
  },

  createAccount: async (input) => {
    await core.init();
    const acct = await core.acctService.createAccount(input);
    const accounts = await core.acctRepo.findAll();
    set({ accounts });
    return acct;
  },

  updateAccount: async (id, patch) => {
    await core.init();
    const acct = await core.acctService.updateAccount(id, patch);
    const accounts = await core.acctRepo.findAll();
    set({ accounts });
    return acct;
  },

  deleteAccount: async (id, force) => {
    await core.init();
    await core.acctService.deleteAccount(id, force);
    const accounts = await core.acctRepo.findAll();
    set({ accounts });
  },

  setActiveAccount: (id) => set({ activeAccountId: id }),
}));
