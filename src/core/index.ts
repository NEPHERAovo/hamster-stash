import { IndexedDBAdapter } from './adapters/IndexedDBAdapter';
import { AccountRepository } from './repositories/AccountRepository';
import { TransactionRepository } from './repositories/TransactionRepository';
import { CategoryRepository } from './repositories/CategoryRepository';
import { SettingsRepository } from './repositories/SettingsRepository';
import { AttachmentRepository } from './repositories/AttachmentRepository';
import { TransactionService } from '../domain/transaction/transactionService';
import { AccountService } from '../domain/account/accountService';
import { CategoryService } from '../domain/category/categoryService';
import { SettingsService } from '../domain/settings/settingsService';
import { SeedService } from '../domain/bootstrap/seedService';
import {
  DataLifecycleService,
  dataLifecycleService as globalDataLifecycleService,
} from '../domain/data/dataLifecycleService';
import { ImportService } from '../domain/import-export/importService';
import { SyncService, syncService as globalSyncService } from '../domain/sync/syncService';
import { pluginManager } from './plugin/PluginManager';
import { usePluginUIStore } from './plugin/SlotStore';
import { AttachmentStore, attachmentStore } from './attachments/attachmentStore';
import type { DataAdapter } from '../types/adapter';
import type { MiddlewareRunner } from '../types/middleware';

export class CoreContext {
  public adapter: DataAdapter;
  public acctRepo: AccountRepository;
  public txRepo: TransactionRepository;
  public catRepo: CategoryRepository;
  public settingsRepo: SettingsRepository;
  public attachmentRepo: AttachmentRepository;
  public seedService: SeedService;
  public catService: CategoryService;
  public settingsService: SettingsService;
  public importService: ImportService;
  public dataLifecycleService: DataLifecycleService;
  public syncService: SyncService;
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

    const runMiddleware: MiddlewareRunner | undefined = customAdapter
      ? undefined
      : (hookName, payload, finalHandler) =>
          pluginManager.runMiddleware(hookName, payload, finalHandler);

    const resetActivePlugins = customAdapter
      ? undefined
      : async () => {
          const enabledPlugins = usePluginUIStore.getState().enabledPlugins;
          for (const p of pluginManager.getPlugins()) {
            const id = p.manifest.id;
            const isEnabled = enabledPlugins[id] ?? p.manifest.defaultEnabled ?? true;
            if (isEnabled) {
              await pluginManager.disablePlugin(id);
              await pluginManager.enablePlugin(id);
            }
          }
        };

    const onDataImported = customAdapter
      ? undefined
      : () => pluginManager.emitHostEvent('data:imported');

    this.seedService = new SeedService(resolveAdapter);
    this.catService = new CategoryService(this.catRepo, this.txRepo);
    this.settingsService = new SettingsService(this.settingsRepo);
    this.importService = new ImportService();
    this.txService = new TransactionService(
      this.txRepo,
      this.acctRepo,
      this.catRepo,
      runMiddleware
    );
    this.acctService = new AccountService(this.acctRepo, this.txRepo, runMiddleware);

    const lifecycleDeps = {
      adapterResolver: resolveAdapter,
      ensureReady: () => this.init(),
      txRepo: this.txRepo,
      acctRepo: this.acctRepo,
      catRepo: this.catRepo,
      seedService: this.seedService,
      onDataImported,
      resetActivePlugins,
    };
    const scopedAttachmentStore = customAdapter
      ? new AttachmentStore(resolveAdapter, () => this.init())
      : attachmentStore;

    const syncDeps = {
      ensureReady: () => this.init(),
      settingsService: this.settingsService,
      dataLifecycleService: globalDataLifecycleService,
      attachmentStore: scopedAttachmentStore,
      onDataImported,
    };

    if (customAdapter) {
      this.dataLifecycleService = new DataLifecycleService(lifecycleDeps);
      this.syncService = new SyncService({
        ...syncDeps,
        dataLifecycleService: this.dataLifecycleService,
      });
    } else {
      globalDataLifecycleService.configure?.(lifecycleDeps);
      this.dataLifecycleService = globalDataLifecycleService;
      globalSyncService.configure?.({
        ...syncDeps,
        dataLifecycleService: this.dataLifecycleService,
      });
      this.syncService = globalSyncService;
      pluginManager.bindAdapter(resolveAdapter, () => this.init());
      attachmentStore.bindAdapter(resolveAdapter, () => this.init());
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
