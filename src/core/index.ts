import { IndexedDBAdapter } from './adapters/IndexedDBAdapter';
import { AccountRepository } from './repositories/AccountRepository';
import { TransactionRepository } from './repositories/TransactionRepository';
import { CategoryRepository } from './repositories/CategoryRepository';
import { SettingsRepository } from './repositories/SettingsRepository';
import { AttachmentRepository } from './repositories/AttachmentRepository';
import { TransactionService } from '../domain/transaction/transactionService';
import { AccountService } from '../domain/account/accountService';
import { SeedService } from '../domain/bootstrap/seedService';
import { DataLifecycleService } from '../domain/data/dataLifecycleService';
import { pluginManager } from './plugin/PluginManager';
import { attachmentStore } from './attachments/attachmentStore';
import type { DataAdapter } from '../types/adapter';

export class CoreContext {
  public adapter: DataAdapter;
  public acctRepo: AccountRepository;
  public txRepo: TransactionRepository;
  public catRepo: CategoryRepository;
  public settingsRepo: SettingsRepository;
  public attachmentRepo: AttachmentRepository;
  public seedService: SeedService;
  public dataLifecycleService: DataLifecycleService;
  public txService: TransactionService;
  public acctService: AccountService;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(customAdapter?: DataAdapter) {
    this.adapter = customAdapter || new IndexedDBAdapter();
    const resolveAdapter = () => this.adapter;

    this.acctRepo = new AccountRepository(resolveAdapter);
    this.txRepo = new TransactionRepository(resolveAdapter);
    this.catRepo = new CategoryRepository(resolveAdapter);
    this.settingsRepo = new SettingsRepository(resolveAdapter);
    this.attachmentRepo = new AttachmentRepository(resolveAdapter);

    this.seedService = new SeedService(resolveAdapter);
    this.dataLifecycleService = new DataLifecycleService(resolveAdapter);
    this.txService = new TransactionService(this.txRepo, this.acctRepo, this.catRepo);
    this.acctService = new AccountService(this.acctRepo, this.txRepo);

    if (!customAdapter) {
      pluginManager.bindAdapter(
        resolveAdapter,
        () => this.init()
      );
      attachmentStore.bindAdapter(
        resolveAdapter,
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
