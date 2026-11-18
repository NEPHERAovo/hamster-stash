import React, { useRef, useState } from 'react';
import {
  Coins,
  SlidersHorizontal,
  FileSpreadsheet,
  FileUp,
  HardDriveUpload,
  ChevronRight,
  Blocks,
} from 'lucide-react';
import { core } from '../../core';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { toast } from '../../stores/useToastStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { ThemeSelector } from '../ui/ThemeSelector';
import { SegToggle } from '../ui/SegToggle';
import { PaperModal } from '../ui/PaperModal';
import { ExportCsvModal } from './ExportCsvModal';
import { WebDavSyncSection } from './WebDavSyncSection';
import { pluginManager } from '../../core/plugin/PluginManager';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { cn } from '../../utils/cn';

export interface SettingsCardProps {
  isDark?: boolean;
  onToggleDark?: () => void;
  onOpenImport?: () => void;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  onOpenImport,
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const { loadAccounts } = useAccountStore();
  const { loadMonth } = useLedgerStore();
  const { loadCategories } = useCategoryStore();
  const { uiStyle, setUiStyle, colorMode, setColorMode } = useThemeStore();
  const { majorThresholdYuan, setMajorThresholdYuan } = usePreferenceStore();

  const [isMajorModalOpen, setIsMajorModalOpen] = useState(false);
  const [majorInput, setMajorInput] = useState(String(majorThresholdYuan));
  const [isExportCsvOpen, setIsExportCsvOpen] = useState(false);

  const openMajorModal = () => {
    setMajorInput(String(majorThresholdYuan));
    setIsMajorModalOpen(true);
  };

  const handleSaveMajorThreshold = () => {
    const val = Number(majorInput.trim());
    if (!Number.isFinite(val) || val < 1) {
      toast.error('请输入大于等于 1 的有效金额');
      return;
    }
    setMajorThresholdYuan(Math.round(val));
    setIsMajorModalOpen(false);
    toast.success(`大额阈值已设为 ¥${Math.round(val)}`);
  };

  const enabledPlugins = usePluginUIStore((s) => s.enabledPlugins);
  const plugins = pluginManager.getPlugins();

  const handleTogglePlugin = async (id: string, currentEnabled: boolean) => {
    try {
      if (currentEnabled) {
        await pluginManager.disablePlugin(id);
        const p = plugins.find((x) => x.manifest.id === id);
        toast.info(`已停用插件: ${p?.manifest.name || id}`);
      } else {
        await pluginManager.enablePlugin(id);
        const p = plugins.find((x) => x.manifest.id === id);
        toast.success(`已启用插件: ${p?.manifest.name || id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切换插件失败');
    }
  };

  const handleExportJson = async () => {
    try {
      await core.init();
      const exportData = await core.adapter.export();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HamsterStash_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('JSON 备份导出成功');
    } catch {
      toast.error('导出 JSON 备份失败');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.transactions || !data.accounts) {
        throw new Error('无效的备份文件结构');
      }

      await core.init();
      await core.adapter.import(data);

      await loadAccounts();
      await loadCategories();
      await loadMonth();
      await useThemeStore.getState().loadThemeFromDB();
      await usePreferenceStore.getState().loadPreferencesFromDB();

      toast.success('JSON 数据恢复成功！');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复备份数据失败');
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3.5 mb-8 select-none">
      <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider">
        <span>外观风格</span>
      </div>

      <SegToggle
        options={[
          { value: 'modern', label: '液态玻璃' },
          { value: 'paper', label: '手帐拟物' },
        ]}
        value={uiStyle}
        onChange={setUiStyle}
        size="sm"
      />

      <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1">
        <span>色彩模式</span>
      </div>

      <SegToggle
        options={[
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
          { value: 'auto', label: '跟随系统' },
        ]}
        value={colorMode}
        onChange={setColorMode}
        size="sm"
      />

      {uiStyle === 'paper' && (
        <>
          <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1">
            <span>配色主题</span>
          </div>

          <div className="p-3 bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-md) shadow-xs">
            <ThemeSelector />
          </div>
        </>
      )}

      <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1">
        <span>设置</span>
      </div>

      <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs px-3.5">

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={openMajorModal}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">大额消费阈值</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            <span>≥ ¥{majorThresholdYuan}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={() => toast.info('当前货币为 CNY')}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <Coins className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">默认货币</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            <span>CNY</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={onOpenImport}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <FileUp className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">导入账本</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={() => setIsExportCsvOpen(true)}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <FileSpreadsheet className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">导出账本</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 last:border-b-0 cursor-pointer select-none"
          onClick={handleExportJson}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <HardDriveUpload className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">全量备份</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                jsonFileInputRef.current?.click();
              }}
              className="text-[11px] text-(--ink-secondary) hover:text-(--ink-primary) underline cursor-pointer mr-1"
            >
              恢复
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
          <input
            ref={jsonFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>

        <div
          className="flex items-center justify-between py-3 cursor-pointer select-none"
          onClick={() => toast.info('仓鼠囤囤 v0.2.2 - 集日常收支、物品收纳与资产管理于一体的轻量化个人账本')}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-(--badge-radius) overflow-hidden flex items-center justify-center shrink-0 border border-(--rule-hairline) bg-(--paper-sunken)">
              <img src="/pwa-64x64.png" alt="仓鼠囤囤" className="w-full h-full object-cover" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">关于</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            <span>v0.2.2</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <WebDavSyncSection />

      {plugins.length > 0 && (
        <>
          <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1 flex items-center justify-between">
            <span>插件扩展</span>
            <span className="text-[10px] text-(--ink-faint) font-normal">MODULAR EXTENSIONS</span>
          </div>

          <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs px-3.5 divide-y divide-dashed divide-(--rule-hairline)/60">
            {plugins.map((p) => {
              const isEnabled = enabledPlugins[p.manifest.id] ?? p.manifest.defaultEnabled ?? true;
              return (
                <div
                  key={p.manifest.id}
                  className="flex items-center justify-between py-2.5 select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                      <Blocks className="w-3.5 h-3.5 stroke-[1.75]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-(--ink-primary) truncate">
                          {p.manifest.name}
                        </span>
                        <span className="text-[10px] font-mono text-(--ink-tertiary)">
                          v{p.manifest.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-(--ink-tertiary) truncate leading-tight mt-0.5">
                        {p.manifest.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'w-8 h-4.5 rounded-full border transition-colors relative cursor-pointer select-none shrink-0',
                      isEnabled
                        ? 'bg-(--ink-primary) border-(--ink-primary)'
                        : 'bg-(--paper-sunken) border-(--rule-hairline)'
                    )}
                    onClick={() => handleTogglePlugin(p.manifest.id, isEnabled)}
                  >
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full bg-(--paper-sheet) shadow-2xs absolute top-0.5 transition-transform duration-200',
                        isEnabled ? 'left-4' : 'left-0.5'
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <PluginSlot name="settings.sections" />

      <PaperModal
        isOpen={isMajorModalOpen}
        onClose={() => setIsMajorModalOpen(false)}
        title="大额消费阈值"
        subtitle="账本筛选“大额”时生效"
      >
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[100, 200, 500, 1000, 2000].map((preset) => {
              const isSelected = Number(majorInput) === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMajorInput(String(preset))}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono rounded-(--btn-radius) border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) border-transparent font-semibold'
                      : 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline) hover:text-(--ink-primary)'
                  )}
                >
                  ¥{preset}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">自定义金额（元）</label>
            <div className="flex items-center gap-2 px-3 h-10 rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline)">
              <span className="font-mono text-sm text-(--ink-tertiary)">¥</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={majorInput}
                onChange={(e) => setMajorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveMajorThreshold();
                }}
                placeholder="输入金额"
                className="flex-1 bg-transparent text-sm font-mono font-semibold text-(--ink-primary) outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setIsMajorModalOpen(false)}
              className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveMajorThreshold}
              className="flex-1 h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer"
            >
              保存
            </button>
          </div>
        </div>
      </PaperModal>

      <ExportCsvModal
        isOpen={isExportCsvOpen}
        onClose={() => setIsExportCsvOpen(false)}
      />
    </div>
  );
};

export default SettingsCard;
