import type { ReactNode, ComponentType } from 'react';

export interface PluginManifest {
  readonly id: string;               // 唯一插件标识，如 "owned-items"
  readonly name: string;             // 展示名称，如 "持有物品与成本分析"
  readonly version: string;          // 语义化版本，如 "1.0.0"
  readonly description: string;      // 手帐风极简描述
  readonly icon: string;             // Lucide 图标名称，如 "package"
  readonly defaultEnabled: boolean;  // 默认是否激活
}

export interface PluginCollection<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface MiddlewareContext<P = unknown> {
  payload: P;
  readonly hookName: string;
}

export type MiddlewareHandler<P = unknown, R = unknown> = (
  context: {
    payload: P;
    next: (modifiedPayload?: P) => Promise<R>;
  },
  next: (modifiedPayload?: P) => Promise<R>
) => Promise<R>;

export interface PluginContext {
  readonly pluginId: string;

  readonly ui: {
    registerSlot(slotName: string, render: (props: Record<string, unknown>) => ReactNode, order?: number): void;
    registerOverride<P = Record<string, unknown>>(
      pointName: string,
      overrideRender: (props: P, OriginalComponent: ComponentType<P>) => ReactNode
    ): void;
    registerSubPage(subPageId: string, component: ComponentType<Record<string, unknown>>): void;
    openSubPage(subPageId: string, params?: Record<string, unknown>): void;
    closeSubPage(): void;
    registerModal(modalId: string, component: ComponentType<Record<string, unknown>>): void;
    openModal(modalId: string, params?: Record<string, unknown>): void;
    closeModal(): void;
    registerNavTab(tab: {
      id: string;
      label: string;
      icon: string;
      order?: number;
      component: ComponentType<Record<string, unknown>>;
    }): void;
  };

  readonly storage: {
    collection<T extends { id: string }>(collectionName: string): PluginCollection<T>;
  };

  readonly settings: {
    get<T>(key: string, defaultValue?: T): Promise<T>;
    set<T>(key: string, value: T): Promise<void>;
  };

  readonly middleware: {
    use<P = unknown, R = unknown>(
      hookName: 'transaction:record' | 'transaction:update' | 'transaction:delete' | 'account:netWorth' | string,
      handler: MiddlewareHandler<P, R>
    ): void;
    register<P = unknown, R = unknown>(
      hookName: 'transaction:record' | 'transaction:update' | 'transaction:delete' | 'account:netWorth' | string,
      handler: MiddlewareHandler<P, R>
    ): void;
  };

  readonly events: {
    on(event: string, handler: (...args: unknown[]) => void): () => void;
    emit(event: string, ...args: unknown[]): void;
  };
}

export abstract class BasePlugin {
  abstract readonly manifest: PluginManifest;
  abstract onActivate(ctx: PluginContext): Promise<void> | void;
  onDeactivate?(ctx: PluginContext): Promise<void> | void;
  renderSettings?(ctx: PluginContext): ReactNode;
}

export interface LazyPluginDefinition {
  readonly manifest: PluginManifest;
  readonly load: () => Promise<BasePlugin>;
}

export interface SlotDescriptor {
  pluginId: string;
  slotName: string;
  render: (props: Record<string, unknown>) => ReactNode;
  order: number;
}

export interface OverrideDescriptor {
  pluginId: string;
  pointName: string;
  overrideRender: (props: Record<string, unknown>, OriginalComponent: ComponentType<Record<string, unknown>>) => ReactNode;
}

export interface NavTabDescriptor {
  readonly pluginId: string;
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly order?: number;
  readonly component: ComponentType<Record<string, unknown>>;
}
