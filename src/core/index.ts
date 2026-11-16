import { IndexedDBAdapter } from './adapters/IndexedDBAdapter';
import { AccountRepository } from './repositories/AccountRepository';
import { TransactionRepository } from './repositories/TransactionRepository';
import { CategoryRepository } from './repositories/CategoryRepository';
import { TransactionService } from '../domain/transaction/transactionService';
import { AccountService } from '../domain/account/accountService';
import type { DataAdapter } from '../types/adapter';

class CoreContext {
  private adapter: DataAdapter;
  public acctRepo: AccountRepository;
  public txRepo: TransactionRepository;
  public catRepo: CategoryRepository;
  public txService: TransactionService;
  public acctService: AccountService;
  private initialized = false;

  constructor(customAdapter?: DataAdapter) {
    this.adapter = customAdapter || new IndexedDBAdapter();
    this.acctRepo = new AccountRepository(this.adapter);
    this.txRepo = new TransactionRepository(this.adapter);
    this.catRepo = new CategoryRepository(this.adapter);

    this.txService = new TransactionService(this.txRepo, this.acctRepo, this.catRepo);
    this.acctService = new AccountService(this.acctRepo, this.txRepo);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.adapter.initialize();
    this.initialized = true;
  }
}

export const core = new CoreContext();
