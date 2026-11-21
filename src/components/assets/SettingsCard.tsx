import React, { useRef, useState } from 'react';
import { SlidersHorizontal, Receipt as ReceiptText, CalendarCheck as CalendarClock, Tag as Tags, FileCsv as FileSpreadsheet, UploadSimple as FileUp, UploadSimple as HardDriveUpload, CaretRight as ChevronRight, SquaresFour as Blocks, Trash as Trash2, ArrowsClockwise as RefreshCw, DownloadSimple as Download } from '@phosphor-icons/react';
import { core } from '../../core';
import type { ExportData } from '../../types/adapter';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { toast } from '../../stores/useToastStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { usePwaStore } from '../../stores/usePwaStore';
import { ThemeSelector } from '../ui/ThemeSelector';
import { SegToggle } from '../ui/SegToggle';
import { PaperModal } from '../ui/PaperModal';
import { ExportCsvModal } from './ExportCsvModal';
import { ClearAllDataModal } from './ClearAllDataModal';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';
import { WebDavSyncSection } from './WebDavSyncSection';
import { pluginManager } from '../../core/plugin/PluginManager';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { cn } from '../../utils/cn';
import { todayDate } from '../../utils/date';

export interface SettingsCardProps {
  isDark?: boolean;
  onToggleDark?: () => void;
  onOpenImport?: () => void;
  onOpenCategories?: () => void;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  onOpenImport,
  onOpenCategories,
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const { accounts, loadAccounts } = useAccountStore();
  const { allTransactions, loadMonth, loadTransactions, loadSettlementSummary } = useLedgerStore();
  const { categories, loadCategories } = useCategoryStore();
  const { uiStyle, setUiStyle, colorMode, setColorMode } = useThemeStore();
  const {
    majorThresholdYuan,
    setMajorThresholdYuan,
    isReimbursementEnabled,
    setReimbursementEnabled,
    isAmortizationEnabled,
    setAmortizationEnabled,
  } = usePreferenceStore();
  const {
    needRefresh,
    isChecking,
    isInstalled,
    installPrompt,
    applyUpdate,
    checkForUpdates,
    promptInstall,
  } = usePwaStore();

  const [isMajorModalOpen, setIsMajorModalOpen] = useState(false);
  const [majorInput, setMajorInput] = useState(String(majorThresholdYuan));
  const [isExportCsvOpen, setIsExportCsvOpen] = useState(false);
  const [isBackupConfirmOpen, setIsBackupConfirmOpen] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; data: ExportData } | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

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

  const handleInstallClick = async () => {
    if (isInstalled) return;
    if (installPrompt) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') return;
    }
    setIsInstallGuideOpen(true);
  };

  const handleExportJson = async () => {
    setIsExportingBackup(true);
    try {
      await core.init();
      const exportData = await core.adapter.export();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HamsterStash_backup_${todayDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setIsBackupConfirmOpen(false);
      toast.success('JSON 备份导出成功');
    } catch {
      toast.error('导出 JSON 备份失败');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;
      if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
        throw new Error('无效的备份文件结构');
      }
      setPendingRestore({ fileName: file.name, data });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '备份文件解析失败');
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    }
  };

  const handleConfirmRestoreJson = async () => {
    if (!pendingRestore) return;
    setIsRestoringBackup(true);
    try {
      await core.init();
      await core.adapter.import(pendingRestore.data);

      await loadAccounts();
      await loadCategories();
      await loadMonth();
      await useThemeStore.getState().loadThemeFromDB();
      await usePreferenceStore.getState().loadPreferencesFromDB();

      setPendingRestore(null);
      toast.success('JSON 数据恢复成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复备份数据失败');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleClearAllData = async () => {
    await core.init();
    await core.adapter.clearAll();

    await loadAccounts();
    await loadCategories();
    await loadTransactions();
    await loadSettlementSummary();

    for (const p of plugins) {
      const id = p.manifest.id;
      const isEnabled = enabledPlugins[id] ?? p.manifest.defaultEnabled ?? true;
      if (isEnabled) {
        await pluginManager.disablePlugin(id);
        await pluginManager.enablePlugin(id);
      }
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
          onClick={onOpenCategories}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <Tags className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">分类管理</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={openMajorModal}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">大额阈值</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            <span>≥ ¥{majorThresholdYuan}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <ReceiptText className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">报销功能</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isReimbursementEnabled}
            onClick={() => setReimbursementEnabled(!isReimbursementEnabled)}
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0',
              isReimbursementEnabled ? 'bg-(--color-income)' : 'bg-(--paper-sunken) border border-(--rule-hairline)'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-(--paper-sheet) transition-transform shadow-xs',
                isReimbursementEnabled ? 'left-4.5' : 'left-0.5'
              )}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <CalendarClock className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">分期支出</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAmortizationEnabled}
            onClick={() => setAmortizationEnabled(!isAmortizationEnabled)}
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0',
              isAmortizationEnabled ? 'bg-(--color-income)' : 'bg-(--paper-sunken) border border-(--rule-hairline)'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-(--paper-sheet) transition-transform shadow-xs',
                isAmortizationEnabled ? 'left-4.5' : 'left-0.5'
              )}
            />
          </button>
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
          onClick={() => setIsBackupConfirmOpen(true)}
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

        {!isInstalled && (
          <div
            className="flex items-center justify-between py-2.5 border-t border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
            onClick={handleInstallClick}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                <Download className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">添加到桌面</span>
            </div>
            <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
              {installPrompt ? (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-(--color-income-bg) text-(--color-income) font-semibold">
                  直接安装
                </span>
              ) : (
                <span>安装指引</span>
              )}
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        <div
          className="flex items-center justify-between py-2.5 border-t border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
          onClick={async () => {
            if (needRefresh) {
              await applyUpdate();
              return;
            }
            const status = await checkForUpdates();
            if (status === 'update_available') {
              toast.info('发现新版本资源，请点击立即更新');
            } else if (status === 'up_to_date') {
              toast.success('当前已是最新版本');
            } else {
              toast.info('当前环境未启用离线缓存更新');
            }
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
              <RefreshCw className={cn('w-3.5 h-3.5 stroke-[1.75]', isChecking && 'animate-spin')} />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">检查更新</span>
          </div>
          <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
            {needRefresh ? (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-(--color-income-bg) text-(--color-income) font-semibold">
                有新版本
              </span>
            ) : (
              <span>{isChecking ? '检查中...' : '离线缓存'}</span>
            )}
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          className="flex items-center justify-between py-3 border-t border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
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
          <div className="px-1 text-xs font-mono text-(--ink-tertiary) tracking-wider pt-1">
            <span>插件扩展</span>
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

      <div className="px-1 text-xs font-mono text-(--color-expense) uppercase tracking-wider pt-1">
        <span>危险操作</span>
      </div>

      <div className="bg-(--paper-sheet) paper-card border border-(--color-expense)/30 rounded-(--radius-lg) overflow-hidden shadow-xs px-3.5">
        <div
          className="flex items-center justify-between py-2.5 cursor-pointer select-none"
          onClick={() => setIsClearAllOpen(true)}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-(--badge-radius) bg-(--color-expense-bg) flex items-center justify-center text-(--color-expense) shrink-0">
              <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="text-[13px] font-medium text-(--color-expense)">清空所有数据</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-(--color-expense)/70" />
        </div>
      </div>

      <PaperModal
        isOpen={isMajorModalOpen}
        onClose={() => setIsMajorModalOpen(false)}
        title="大额阈值"
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
            <label className="text-xs font-mono text-(--ink-tertiary)">自定义金额</label>
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

      <PaperModal
        isOpen={isBackupConfirmOpen}
        onClose={() => setIsBackupConfirmOpen(false)}
        title="确认全量备份"
      >
        <div className="p-4 space-y-4 select-none">
          <div className="p-3 rounded-(--radius-sm) bg-(--paper-sunken)/70 border border-dashed border-(--rule-hairline) text-xs font-mono space-y-1.5">
            <div className="flex items-center justify-between text-(--ink-secondary)">
              <span>记账流水</span>
              <span className="font-semibold text-(--ink-solid)">{allTransactions.length} 笔</span>
            </div>
            <div className="flex items-center justify-between text-(--ink-secondary)">
              <span>资金账户</span>
              <span className="font-semibold text-(--ink-solid)">{accounts.length} 个</span>
            </div>
            <div className="flex items-center justify-between text-(--ink-secondary)">
              <span>收支分类</span>
              <span className="font-semibold text-(--ink-solid)">{categories.length} 项</span>
            </div>
          </div>

          <p className="text-xs text-(--ink-tertiary) leading-relaxed">
            备份文件包含全部流水、账户、分类、偏好配置与插件扩展数据，可用于跨设备迁移或覆盖恢复。
          </p>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setIsBackupConfirmOpen(false)}
              className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isExportingBackup}
              onClick={handleExportJson}
              className="flex-1 h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isExportingBackup ? '导出中...' : '确认导出备份'}
            </button>
          </div>
        </div>
      </PaperModal>

      <PaperModal
        isOpen={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        title="确认恢复备份"
        subtitle={pendingRestore?.fileName}
      >
        <div className="p-4 space-y-4 select-none">
          {pendingRestore && (
            <div className="p-3 rounded-(--radius-sm) bg-(--paper-sunken)/70 border border-dashed border-(--rule-hairline) text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between text-(--ink-secondary)">
                <span>备份流水</span>
                <span className="font-semibold text-(--ink-solid)">{pendingRestore.data.transactions.length} 笔</span>
              </div>
              <div className="flex items-center justify-between text-(--ink-secondary)">
                <span>备份账户</span>
                <span className="font-semibold text-(--ink-solid)">{pendingRestore.data.accounts.length} 个</span>
              </div>
            </div>
          )}

          <p className="text-xs text-(--color-expense) leading-relaxed">
            恢复操作将完全覆盖当前设备中的所有账本数据，此操作不可撤销，请确认已做好备份。
          </p>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setPendingRestore(null)}
              className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isRestoringBackup}
              onClick={handleConfirmRestoreJson}
              className="flex-1 h-10 rounded-(--btn-radius) bg-(--color-expense) text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isRestoringBackup ? '恢复中...' : '确认覆盖恢复'}
            </button>
          </div>
        </div>
      </PaperModal>

      <ClearAllDataModal
        isOpen={isClearAllOpen}
        transactionCount={allTransactions.length}
        accountCount={accounts.length}
        onClose={() => setIsClearAllOpen(false)}
        onRequestBackup={() => setIsBackupConfirmOpen(true)}
        onConfirmClear={handleClearAllData}
      />

      <PwaInstallGuideModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />
    </div>
  );
};

export default SettingsCard;
