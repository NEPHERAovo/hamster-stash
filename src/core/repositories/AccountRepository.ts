import type { DataAdapter } from '../../types/adapter';
import type { Account } from '../../types/account';
import { STORES } from '../db/schema';

export class AccountRepository {
  private adapter: DataAdapter;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  async findById(id: string): Promise<Account | null> {
    const acct = await this.adapter.read<Account>(STORES.ACCOUNTS, id);
    if (!acct) return null;
    return {
      ...acct,
      type: acct.type === 'credit' ? 'credit' : 'savings',
      balance: Number.isFinite(acct.balance) ? acct.balance : 0,
    };
  }

  async findAll(): Promise<Account[]> {
    const items = await this.adapter.query<Account>(STORES.ACCOUNTS, {
      orderBy: 'sortOrder',
      orderDirection: 'asc',
    });
    return items.map((acct) => ({
      ...acct,
      type: acct.type === 'credit' ? 'credit' : 'savings',
      balance: Number.isFinite(acct.balance) ? acct.balance : 0,
    }));
  }

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Account> {
    return this.adapter.create<Account>(STORES.ACCOUNTS, data);
  }

  async update(id: string, data: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account> {
    return this.adapter.update<Account>(STORES.ACCOUNTS, id, data);
  }

  async delete(id: string): Promise<void> {
    return this.adapter.delete(STORES.ACCOUNTS, id);
  }

  /**
   * 变动指定账户余额（加正数或减负数，单位：分）
   */
  async adjustBalance(id: string, deltaCents: number): Promise<Account> {
    const acct = await this.findById(id);
    if (!acct) {
      throw new Error(`Account ${id} not found`);
    }
    const newBalance = acct.balance + deltaCents;
    return this.update(id, { balance: newBalance });
  }

  /**
   * 直接校准账户余额至指定值（单位：分）
   */
  async setBalance(id: string, targetBalanceCents: number): Promise<Account> {
    return this.update(id, { balance: targetBalanceCents });
  }
}
