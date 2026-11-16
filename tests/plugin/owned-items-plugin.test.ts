import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '../../src/core/plugin/PluginManager';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { OwnedItemsPlugin } from '../../src/plugins/owned-items';
import { usePluginUIStore } from '../../src/core/plugin/SlotStore';
import { usePluginItemStore } from '../../src/plugins/owned-items/store/usePluginItemStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import {
  computeItemMetrics,
  computeOverallItemMetrics,
} from '../../src/plugins/owned-items/domain/itemCalculator';
import type { Item } from '../../src/plugins/owned-items/types';
import type { Transaction } from '../../src/plugin-sdk';
import type { CreateTransactionInput } from '../../src/domain/transaction/transactionService';

describe('OwnedItemsPlugin (标准参考插件：持有物品管理)', () => {
  let adapter: MemoryAdapter;
  let manager: PluginManager;
  let plugin: OwnedItemsPlugin;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    manager = new PluginManager(adapter);
    plugin = new OwnedItemsPlugin();
    manager.registerPlugin(plugin);

    usePluginUIStore.setState({
      slots: {},
      overrides: {},
      registeredSubPages: {},
      registeredModals: {},
      subPageStack: [],
      activeSubPage: null,
      activeModal: null,
      enabledPlugins: {},
      navTabs: [],
    });

    useCategoryStore.setState({
      categories: [
        {
          id: 'cat_digital',
          name: '数码数码',
          type: 'expense',
          icon: 'laptop',
          color: 'var(--cat-shop)',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
  });

  it('激活插件后注册底部一级导航 Tab、手帐 UI 插槽、子页面与弹窗', async () => {
    await manager.init();

    expect(manager.isPluginEnabled('owned-items')).toBe(true);

    const uiState = usePluginUIStore.getState();

    const itemsTab = uiState.navTabs.find((t) => t.id === 'items');
    expect(itemsTab).toBeDefined();
    expect(itemsTab?.label).toBe('物品');
    expect(itemsTab?.order).toBe(25);
    expect(itemsTab?.icon).toBe('package');

    expect(uiState.slots['tx.modal.metaBar']?.length).toBe(1);
    expect(uiState.slots['tx.modal.metaTray']?.length).toBe(1);
    expect(uiState.slots['tx.row.badges']?.length).toBe(1);

    expect(uiState.registeredSubPages['item-list']).toBeDefined();
    expect(uiState.registeredSubPages['item-detail']).toBeDefined();
    expect(uiState.registeredModals['item-form']).toBeDefined();
  });

  it('中间件拦截：支出态下勾选 createNewItem 时自动由账单生成新物品并关联 buy 角色', async () => {
    await manager.init();

    const inputPayload: CreateTransactionInput = {
      type: 'expense',
      amount: 799900,
      date: '2026-05-20',
      accountId: 'acct_1',
      categoryId: 'cat_digital',
      note: 'MacBook Air M3',
      ext: {
        'owned-items': {
          createNewItem: true,
        },
      },
    };

    await manager.runMiddleware(
      'transaction:record',
      { input: inputPayload },
      async () => ({ id: 'mock_tx_buy' })
    );

    const items = usePluginItemStore.getState().items;
    const createdItem = items.find((i) => i.name === 'MacBook Air M3');
    expect(createdItem).toBeDefined();
    expect(createdItem?.status).toBe('using');
    expect(createdItem?.buyDate).toBe('2026-05-20');
    expect(createdItem?.icon).toBe('laptop');

    expect(inputPayload.ext['owned-items'].itemId).toBe(createdItem?.id);
    expect(inputPayload.ext['owned-items'].itemRole).toBe('buy');
    expect(inputPayload.ext['owned-items'].createNewItem).toBeUndefined();
  });

  it('中间件拦截：记录二手售出流水时自动将物品状态流转为 sold', async () => {
    await manager.init();

    const item = await usePluginItemStore.getState().createItem({
      name: 'iPad Mini 6',
      icon: 'smartphone',
      status: 'using',
      buyDate: '2026-01-01',
    });

    expect(item.status).toBe('using');

    await manager.runMiddleware(
      'transaction:record',
      {
        input: {
          type: 'income',
          amount: 250000,
          date: '2026-06-01',
          accountId: 'acct_1',
          categoryId: 'cat_shop',
          ext: {
            'owned-items': {
              itemId: item.id,
              itemRole: 'sell',
            },
          },
        },
      },
      async () => ({ id: 'mock_tx_sell' })
    );

    const updated = usePluginItemStore.getState().items.find((i) => i.id === item.id);
    expect(updated?.status).toBe('sold');
    expect(updated?.endDate).toBe('2026-06-01');
  });

  it('纯函数计算：正确评估累计投入、售出回血、净成本与保值率', () => {
    const item: Item = {
      id: 'item_fuji',
      name: 'Fujifilm X-T5',
      icon: 'camera',
      status: 'sold',
      buyDate: '2026-01-01',
      endDate: '2026-01-11', // 持有 11 天
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx_buy',
        type: 'expense',
        amount: 1100000, // 11,000 元
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-01-01',
        ext: { 'owned-items': { itemId: 'item_fuji', itemRole: 'buy' } },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'tx_acc',
        type: 'expense',
        amount: 100000, // 1,000 元镜头与手柄
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-01-05',
        ext: { 'owned-items': { itemId: 'item_fuji', itemRole: 'maintenance' } },
        createdAt: '2026-01-05T00:00:00.000Z',
        updatedAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'tx_sell',
        type: 'income',
        amount: 960000, // 9,600 元回血售出
        accountId: 'acct_1',
        categoryId: 'cat_shop',
        date: '2026-01-11',
        ext: { 'owned-items': { itemId: 'item_fuji', itemRole: 'sell' } },
        createdAt: '2026-01-11T00:00:00.000Z',
        updatedAt: '2026-01-11T00:00:00.000Z',
      },
    ];

    const metrics = computeItemMetrics(item, transactions);

    expect(metrics.grossCost).toBe(1200000); // 1100000 + 100000
    expect(metrics.recoveredAmount).toBe(960000);
    expect(metrics.netCost).toBe(240000); // 1200000 - 960000 = 2,400 元
    expect(metrics.holdingDays).toBe(11);
    expect(metrics.dailyCost).toBe(Math.round(240000 / 11));
    expect(metrics.retentionRate).toBe(80); // 960000 / 1200000 = 80%

    const overall = computeOverallItemMetrics([item], transactions);
    expect(overall.usingCount).toBe(0); // 已售出，在用数为 0
  });

  it('停用插件后干净卸载 UI 插槽与一级导航 Tab', async () => {
    await manager.init();
    expect(usePluginUIStore.getState().navTabs.some((t) => t.id === 'items')).toBe(true);
    expect(usePluginUIStore.getState().slots['tx.modal.metaBar']?.length).toBe(1);

    await manager.disablePlugin('owned-items');
    expect(manager.isPluginEnabled('owned-items')).toBe(false);

    expect(usePluginUIStore.getState().navTabs.some((t) => t.id === 'items')).toBe(false);
    expect(usePluginUIStore.getState().slots['tx.modal.metaBar']?.length || 0).toBe(0);
  });
});
