import type { Account, AccountType } from '../../types/account';
import type { AccountRepository } from '../../core/repositories/AccountRepository';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import { pluginManager } from '../../core/plugin/PluginManager';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  initialBalance?: number; // 单位：分
  currency?: string;
  icon?: string;
  color?: string;
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

  /**
   * 创建账户
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    if (!input.name || !input.name.trim()) {
      throw new Error('账户名称不能为空');
    }

    const all = await this.acctRepo.findAll();
    const sortOrder = all.length > 0 ? Math.max(...all.map((a) => a.sortOrder)) + 1 : 1;

    return this.acctRepo.create({
      name: input.name.trim(),
      type: input.type,
      balance: input.initialBalance || 0,
      currency: input.currency || 'CNY',
      icon: input.icon || 'wallet',
      color: input.color,
      sortOrder,
    });
  }

  /**
   * 计算所有账户净资产总和（单位：分）
   */
  async calculateNetWorth(): Promise<number> {
    return pluginManager.runMiddleware(
      'account:netWorth',
      {},
      async () => this.internalCalculateNetWorth()
    );
  }

  private async internalCalculateNetWorth(): Promise<number> {
    const accounts = await this.acctRepo.findAll();
    return accounts.reduce((acc, cur) => acc + (cur.isArchived ? 0 : cur.balance), 0);
  }

  /**
   * 删除账户（安全检查：有流水则阻止直接物理删除）
   */
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
