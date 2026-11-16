import { describe, it, expect, beforeEach } from 'vitest';
import { MiddlewarePipeline } from '../../src/core/plugin/MiddlewarePipeline';
import { PluginStorageManager } from '../../src/core/plugin/PluginStorageManager';
import { PluginManager } from '../../src/core/plugin/PluginManager';
import { BasePlugin, type PluginManifest, type PluginContext } from '../../src/core/plugin/types';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { usePluginUIStore } from '../../src/core/plugin/SlotStore';

describe('Plugin Kernel (插件微内核核心能力)', () => {
  describe('MiddlewarePipeline (洋葱模型业务中间件)', () => {
    it('支持中间件顺序执行并修改 payload', async () => {
      const pipeline = new MiddlewarePipeline();
      const logs: string[] = [];

      pipeline.use('test:action', async (ctx, next) => {
        logs.push(`m1 start: ${ctx.payload.val}`);
        ctx.payload.val += 10;
        const res = await next();
        logs.push(`m1 end: ${res}`);
        return res + 1;
      });

      pipeline.use('test:action', async (ctx, next) => {
        logs.push(`m2 start: ${ctx.payload.val}`);
        ctx.payload.val *= 2;
        const res = await next();
        logs.push(`m2 end: ${res}`);
        return res + 2;
      });

      const finalHandler = async (payload: { val: number }) => {
        logs.push(`final: ${payload.val}`);
        return payload.val * 3;
      };

      const result = await pipeline.run('test:action', { val: 5 }, finalHandler);

      expect(result).toBe(93);
      expect(logs).toEqual([
        'm1 start: 5',
        'm2 start: 15',
        'final: 30',
        'm2 end: 90',
        'm1 end: 92',
      ]);
    });

    it('支持中间件短路拦截直接返回结果（替换默认业务行为）', async () => {
      const pipeline = new MiddlewarePipeline();

      pipeline.use('tx:record', async () => {
        return { overridden: true, customId: 'mock_tx_999' };
      });

      const finalHandler = async () => {
        throw new Error('Default handler should not have been called');
      };

      const result = await pipeline.run('tx:record', { id: 'orig' }, finalHandler);
      expect(result).toEqual({ overridden: true, customId: 'mock_tx_999' });
    });
  });

  describe('PluginStorageManager (隔离集合与配置存储)', () => {
    let adapter: MemoryAdapter;
    let storage: PluginStorageManager;

    beforeEach(async () => {
      adapter = new MemoryAdapter();
      await adapter.initialize();
      storage = new PluginStorageManager(adapter);
    });

    it('集合 CRUD 具备插件命名空间隔离', async () => {
      interface MockItem {
        id: string;
        name: string;
      }

      const p1Col = storage.createCollection<MockItem>('plugin-1', 'items');
      const p2Col = storage.createCollection<MockItem>('plugin-2', 'items');

      await p1Col.create({ id: 'item_1', name: 'Item from P1' });
      await p2Col.create({ id: 'item_2', name: 'Item from P2' });

      const p1List = await p1Col.findAll();
      const p2List = await p2Col.findAll();

      expect(p1List.length).toBe(1);
      expect(p1List[0].name).toBe('Item from P1');

      expect(p2List.length).toBe(1);
      expect(p2List[0].name).toBe('Item from P2');

      const foundP1 = await p1Col.findById('item_1');
      expect(foundP1?.name).toBe('Item from P1');

      const notInP1 = await p1Col.findById('item_2');
      expect(notInP1).toBeNull();
    });

    it('设置管理器支持读写与默认回退值', async () => {
      const settings = storage.createSettingsAccessor('test-plugin');

      const defVal = await settings.get<boolean>('enabled', true);
      expect(defVal).toBe(true);

      await settings.set('enabled', false);
      const updated = await settings.get<boolean>('enabled', true);
      expect(updated).toBe(false);
    });
  });

  describe('PluginRegistry & PluginManager (生命周期与启停卸载)', () => {
    let adapter: MemoryAdapter;
    let manager: PluginManager;

    class TestPlugin extends BasePlugin {
      readonly manifest: PluginManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'For testing lifecycle',
        defaultEnabled: true,
      };

      async onActivate(ctx: PluginContext): Promise<void> {
        ctx.ui.registerSlot('test.slot', () => 'Slot Content', 50);
        ctx.ui.registerSubPage('test-subpage', () => null);
        ctx.middleware.register('test:hook', async (mCtx, next) => {
          mCtx.payload.hooked = true;
          return next();
        });
      }

      async onDeactivate(): Promise<void> {}
    }

    beforeEach(async () => {
      adapter = new MemoryAdapter();
      await adapter.initialize();
      manager = new PluginManager(adapter);
      usePluginUIStore.setState({
        slots: {},
        overrides: {},
        registeredSubPages: {},
        registeredModals: {},
        activeSubPage: null,
        activeModal: null,
        enabledPlugins: {},
      });
    });

    it('完整生命周期：注册 -> 激活挂载 -> 停用完全卸载', async () => {
      const plugin = new TestPlugin();
      manager.registerPlugin(plugin);

      expect(manager.getPlugins().length).toBe(1);
      expect(manager.isPluginEnabled('test-plugin')).toBe(false);

      await manager.init();
      expect(manager.isPluginEnabled('test-plugin')).toBe(true);

      const uiState = usePluginUIStore.getState();
      expect(uiState.slots['test.slot']?.length).toBe(1);
      expect(uiState.registeredSubPages['test-subpage']).toBeDefined();

      const mwResult = await manager.runMiddleware('test:hook', { val: 1 }, async (p) => p);
      expect(mwResult).toEqual({ val: 1, hooked: true });

      await manager.disablePlugin('test-plugin');
      expect(manager.isPluginEnabled('test-plugin')).toBe(false);

      const updatedUI = usePluginUIStore.getState();
      expect(updatedUI.slots['test.slot']?.length || 0).toBe(0);

      const bypassResult = await manager.runMiddleware('test:hook', { val: 2 }, async (p) => p);
      expect(bypassResult).toEqual({ val: 2 });
    });
  });
});
