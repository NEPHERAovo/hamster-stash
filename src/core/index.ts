import { IndexedDBAdapter } from './adapters/IndexedDBAdapter';
import { AccountRepository } from './repositories/AccountRepository';
import { TransactionRepository } from './repositories/TransactionRepository';
import { CategoryRepository } from './repositories/CategoryRepository';
import { TransactionService } from '../domain/transaction/transactionService';
import { AccountService } from '../domain/account/accountService';
import { SeedService } from '../domain/bootstrap/seedService';
import { pluginManager } from './plugin/PluginManager';
import { attachmentStore } from './attachments/attachmentStore';
import type { DataAdapter } from '../types/adapter';

export class CoreContext {
  public adapter: DataAdapter;
  public acctRepo: AccountRepository;
  public txRepo: TransactionRepository;
  public catRepo: CategoryRepository;
  public seedService: SeedService;
  public txService: TransactionService;
  public acctService: AccountService;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(customAdapter?: DataAdapter) {
    this.adapter = customAdapter || new IndexedDBAdapter();
    this.acctRepo = new AccountRepository(this.adapter);
    this.txRepo = new TransactionRepository(this.adapter);
    this.catRepo = new CategoryRepository(this.adapter);

    this.seedService = new SeedService(() => this.adapter);
    this.txService = new TransactionService(this.txRepo, this.acctRepo, this.catRepo);
    this.acctService = new AccountService(this.acctRepo, this.txRepo);

    if (!customAdapter) {
      pluginManager.bindAdapter(
        () => this.adapter,
        () => this.init()
      );
      attachmentStore.bindAdapter(
        () => this.adapter,
        () => this.init()
      );
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          await this.adapter.initialize();
          await this.seedService.ensureSeeded();
          this.initialized = true;
        } finally {
          this.initPromise = null;
        }
      })();
    }
    await this.initPromise;
  }
}

export const core = new CoreContext();
