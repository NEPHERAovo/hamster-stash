import type { AdapterResolver } from '../../types/adapter';
import type { Account } from '../../types/account';
import { STORES } from '../db/schema';
import { BaseRepository } from './BaseRepository';

export class AccountRepository extends BaseRepository<Account> {
  constructor(adapterResolver: AdapterResolver) {
    super(adapterResolver, STORES.ACCOUNTS, {
      useTombstone: true,
      defaultOrderBy: 'sortOrder',
      defaultOrderDirection: 'asc',
    });
  }

  async adjustBalance(id: string, deltaCents: number): Promise<Account> {
    const acct = await this.findById(id);
    if (!acct) {
      throw new Error(`Account ${id} not found`);
    }
    const newBalance = acct.balance + deltaCents;
    return this.update(id, { balance: newBalance });
  }

  async setBalance(id: string, targetBalanceCents: number): Promise<Account> {
    return this.update(id, { balance: targetBalanceCents });
  }
}
