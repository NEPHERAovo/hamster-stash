import type { Account, AccountType } from '../../types/account';
import type { AccountRepository } from '../../core/repositories/AccountRepository';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import { pluginManager } from '../../core/plugin/PluginManager';
import { todayDate } from '../../utils/date';

export interface CreateAccountInput {
  name: string;
  note?: string;
  type: AccountType;
  initialBalance?: number;
  currency?: string;
  icon?: string;
  color?: string;
  includeInNetWorth?: boolean;
  creditLimit?: number;
  repaymentDay?: number;
  repaymentAccountId?: string;
  autoRepay?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  note?: string;
  type?: AccountType;
  icon?: string;
  color?: string;
  includeInNetWorth?: boolean;
  creditLimit?: number;
  repaymentDay?: number;
  repaymentAccountId?: string;
  autoRepay?: boolean;
}

export class AccountService {
  private acctRepo: AccountRepository;
  private txRepo?: TransactionRepository;

  constructor(
    acctRepo: AccountRepository,
    txRepo?: TransactionRepository
  ) {
    this.acctRepo = acctRepo;
    this.txRepo = txRepo;
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    if (!input.name || !input.name.trim()) {
      throw new Error('账户名称不能为空');
    }

    const all = await this.acctRepo.findAll();
    const sortOrder = all.length > 0 ? Math.max(...all.map((a) => a.sortOrder)) + 1 : 1;

    const created = await this.acctRepo.create({
      name: input.name.trim(),
      note: input.note?.trim() || undefined,
      type: input.type,
      balance: input.initialBalance || 0,
      currency: input.currency || 'CNY',
      icon: input.icon || (input.type === 'credit' ? 'credit-card' : 'wallet'),
      color: input.color,
      includeInNetWorth: input.includeInNetWorth ?? true,
      creditLimit: input.creditLimit,
      repaymentDay: input.repaymentDay,
      repaymentAccountId: input.repaymentAccountId,
      autoRepay: input.autoRepay,
      sortOrder,
    });

    if (this.txRepo && input.initialBalance && input.initialBalance !== 0) {
      const today = todayDate();
      if (input.initialBalance > 0) {
        await this.txRepo.create({
          type: 'income',
          amount: input.initialBalance,
          accountId: created.id,
          categoryId: 'cat_other_in',
          date: today,
          note: '初始余额',
        });
      } else {
        await this.txRepo.create({
          type: 'expense',
          amount: Math.abs(input.initialBalance),
          accountId: created.id,
          categoryId: 'cat_other',
          date: today,
          note: '初始欠款',
        });
      }
    }

    return created;
  }

  async updateAccount(id: string, patch: UpdateAccountInput): Promise<Account> {
    const existing = await this.acctRepo.findById(id);
    if (!existing) {
      throw new Error('账户不存在');
    }

    const updates: Partial<Account> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) {
        throw new Error('账户名称不能为空');
      }
      updates.name = trimmed;
    }
    if (patch.note !== undefined) updates.note = patch.note.trim() || undefined;
    if (patch.type !== undefined) updates.type = patch.type;
    if (patch.icon !== undefined) updates.icon = patch.icon;
    if (patch.color !== undefined) updates.color = patch.color;
    if (patch.includeInNetWorth !== undefined) updates.includeInNetWorth = patch.includeInNetWorth;
    if (patch.creditLimit !== undefined) updates.creditLimit = patch.creditLimit;
    if (patch.repaymentDay !== undefined) updates.repaymentDay = patch.repaymentDay;
    if (patch.repaymentAccountId !== undefined) updates.repaymentAccountId = patch.repaymentAccountId;
    if (patch.autoRepay !== undefined) updates.autoRepay = patch.autoRepay;

    return this.acctRepo.update(id, updates);
  }

  async calculateNetWorth(): Promise<number> {
    return pluginManager.runMiddleware(
      'account:netWorth',
      {},
      async () => this.internalCalculateNetWorth()
    );
  }

  private async internalCalculateNetWorth(): Promise<number> {
    const accounts = await this.acctRepo.findAll();
    return accounts.reduce(
      (acc, cur) => acc + (cur.isArchived || cur.includeInNetWorth === false ? 0 : cur.balance),
      0
    );
  }

  async deleteAccount(id: string, force: boolean = false): Promise<void> {
    const all = await this.acctRepo.findAll();
    if (all.length <= 1) {
      throw new Error('系统至少需保留一个资金账户');
    }

    if (this.txRepo) {
      const txs = await this.txRepo.findByAccount(id);
      if (txs.length > 0) {
        if (!force) {
          throw new Error(`该账户下已有 ${txs.length} 条交易流水`);
        }
        for (const tx of txs) {
          await this.txRepo.delete(tx.id);
        }
      }
    }
    await this.acctRepo.delete(id);
  }
}
