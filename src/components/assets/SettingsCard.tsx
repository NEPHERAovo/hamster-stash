import React, { useRef } from 'react';
import {
  Moon,
  Coins,
  FileSpreadsheet,
  FileUp,
  HardDriveUpload,
  Info,
  ChevronRight,
  Blocks,
} from 'lucide-react';
import { core } from '../../core';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { exportTransactionsToCsv } from '../../domain/import-export/csvMapper';
import { toast } from '../../stores/useToastStore';
import { ThemeSelector } from '../ui/ThemeSelector';
import { pluginManager } from '../../core/plugin/PluginManager';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { cn } from '../../utils/cn';

export interface SettingsCardProps {
  isDark: boolean;
  onToggleDark: () => void;
  onOpenImport?: () => void;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  isDark,
  onToggleDark,
  onOpenImport,
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const { loadAccounts } = useAccountStore();
  const { loadMonth } = useLedgerStore();
  const { loadCategories } = useCategoryStore();

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

  const handleExportCsv = async () => {
    try {
      await core.init();
      const [txs, cats, accts] = await Promise.all([
        core.txRepo.findAll(),
        core.catRepo.findAll(),
        core.acctRepo.findAll(),
      ]);

      const csvContent = exportTransactionsToCsv(txs, cats, accts);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hamsterStash_records_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('CSV 账本导出成功');
    } catch {
      toast.error('导出 CSV 账本失败');
    }
  };

  const handleExportJson = async () => {
    try {
      await core.init();
      const exportData = await core.txRepo['adapter'].export();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hamsterStash_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      await core.txRepo['adapter'].import(data);

      await loadAccounts();
      await loadCategories();
      await loadMonth();

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
        <span>主题</span>
      </div>

      <div className="p-3 bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
        <ThemeSelector />
      </div>

      <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1">
        <span>设置</span>
      </div>

      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] px-3.5">
        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={onToggleDark}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <Moon className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">深色模式</span>
          </div>
          <div
            className={cn(
              'w-8 h-4.5 rounded-full border transition-colors relative cursor-pointer select-none shrink-0',
              isDark ? 'bg-(--ink-primary) border-(--ink-primary)' : 'bg-(--paper-sunken) border-(--rule-hairline)'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDark();
            }}
          >
            <div
              className={cn(
                'w-3 h-3 rounded-full bg-(--paper-sheet) shadow-2xs absolute top-0.5 transition-transform duration-200',
                isDark ? 'left-4' : 'left-0.5'
              )}
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={() => toast.info('当前货币为 CNY')}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
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
            <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
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
          onClick={handleExportCsv}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
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
            <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
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
          onClick={() => toast.info('hamsterStash 极简记账 PWA v0.2.2')}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xs bg-(--bg-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <Info className="w-4 h-4 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">关于</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            <span>v0.2.2</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {plugins.length > 0 && (
        <>
          <div className="px-1 text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider pt-1 flex items-center justify-between">
            <span>插件扩展</span>
            <span className="text-[10px] text-(--ink-faint) font-normal">MODULAR EXTENSIONS</span>
          </div>

          <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] px-3.5 divide-y divide-dashed divide-(--rule-hairline)/60">
            {plugins.map((p) => {
              const isEnabled = enabledPlugins[p.manifest.id] ?? p.manifest.defaultEnabled ?? true;
              return (
                <div
                  key={p.manifest.id}
                  className="flex items-center justify-between py-2.5 select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-6 h-6 rounded-xs bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
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
    </div>
  );
};

export default SettingsCard;
