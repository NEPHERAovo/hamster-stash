import React, { useState } from 'react';
import { SlidersHorizontalIcon as SlidersHorizontal, ReceiptIcon as ReceiptText, CalendarCheckIcon as CalendarClock, TagIcon as Tags, DatabaseIcon as Database, CaretRightIcon as ChevronRight, SquaresFourIcon as Blocks, TrashIcon as Trash2, ArrowsClockwiseIcon as RefreshCw, DownloadSimpleIcon as Download, FlaskIcon as Flask } from '@phosphor-icons/react';
import { core } from '../../core';
import { isSandboxModeActive, setSandboxMode, resetSandboxData } from '../../core/db/schema';
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
import { PaperSwitch } from '../ui/PaperSwitch';
import { ClearAllDataModal } from './ClearAllDataModal';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';
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
  onOpenDataManage?: () => void;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  onOpenCategories,
  onOpenDataManage,
}) => {
  const { accounts, loadAccounts } = useAccountStore();
  const { allTransactions, loadTransactions, loadSettlementSummary } = useLedgerStore();
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
  const [isBackupConfirmOpen, setIsBackupConfirmOpen] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
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
    <div className="mb-8 space-y-3.5 select-none">
      <div className="px-1 font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
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

      <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
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
          <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
            <span>配色主题</span>
          </div>

          <div className="paper-card rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3 shadow-xs">
            <ThemeSelector />
          </div>
        </>
      )}

      <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
        <span>设置</span>
      </div>

      <div className="paper-card overflow-hidden rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) px-3.5 shadow-xs">

        <div
          className="flex cursor-pointer items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none"
          onClick={onOpenCategories}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <Tags className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">分类管理</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-(--ink-tertiary)">
            <ChevronRight className="size-3.5" />
          </div>
        </div>

        <div
          className="flex cursor-pointer items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none"
          onClick={openMajorModal}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <SlidersHorizontal className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">大额阈值</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-(--ink-tertiary)">
            <span>≥ ¥{majorThresholdYuan}</span>
            <ChevronRight className="size-3.5" />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <ReceiptText className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">报销功能</span>
          </div>
          <PaperSwitch
            checked={isReimbursementEnabled}
            onChange={(checked) => setReimbursementEnabled(checked)}
            aria-label="报销功能"
          />
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <CalendarClock className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">分期支出</span>
          </div>
          <PaperSwitch
            checked={isAmortizationEnabled}
            onChange={(checked) => setAmortizationEnabled(checked)}
            aria-label="分期支出"
          />
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <Flask className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">沙盒测试模式</span>
          </div>
          <div className="flex items-center gap-2">
            {isSandboxModeActive() && (
              <button
                type="button"
                onClick={() => void resetSandboxData()}
                className="cursor-pointer text-[11px] text-(--ink-secondary) underline hover:text-(--ink-primary)"
              >
                重置演示数据
              </button>
            )}
            <PaperSwitch
              checked={isSandboxModeActive()}
              onChange={(checked) => setSandboxMode(checked)}
              aria-label="沙盒测试模式"
            />
          </div>
        </div>

        <div
          className="flex cursor-pointer items-center justify-between border-b border-dashed border-(--rule-hairline)/60 py-2.5 select-none"
          onClick={onOpenDataManage}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <Database className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">数据与备份</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-(--ink-tertiary)">
            <ChevronRight className="size-3.5" />
          </div>
        </div>

        {!isInstalled && (
          <div
            className="flex cursor-pointer items-center justify-between border-t border-dashed border-(--rule-hairline)/60 py-2.5 select-none"
            onClick={handleInstallClick}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                <Download className="stroke-1.75 size-3.5" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">添加到桌面</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-(--ink-tertiary)">
              {installPrompt ? (
                <span className="rounded-full bg-(--color-income-bg) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-income)">
                  直接安装
                </span>
              ) : (
                <span>安装指引</span>
              )}
              <ChevronRight className="size-3.5" />
            </div>
          </div>
        )}

        <div
          className="flex cursor-pointer items-center justify-between border-t border-dashed border-(--rule-hairline)/60 py-2.5 select-none"
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
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <RefreshCw className={cn('stroke-1.75 size-3.5', isChecking && 'animate-spin')} />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">检查更新</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-(--ink-tertiary)">
            {needRefresh && (
              <span className="rounded-full bg-(--color-income-bg) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-income)">
                有新版本
              </span>
            )}
            {isChecking && <span>检查中...</span>}
            <ChevronRight className="size-3.5" />
          </div>
        </div>

        <div
          className="flex cursor-pointer items-center justify-between border-t border-dashed border-(--rule-hairline)/60 py-3 select-none"
          onClick={() => toast.info('仓鼠囤囤 v0.2.2 - 集日常收支、物品收纳与资产管理于一体的轻量化个人账本')}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-(--badge-radius) border border-(--rule-hairline) bg-(--paper-sunken)">
              <img src="/pwa-64x64.png" alt="仓鼠囤囤" className="size-full object-cover" />
            </div>
            <span className="text-[13px] font-medium text-(--ink-primary)">关于</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-(--ink-tertiary)">
            <span>v0.2.2</span>
            <ChevronRight className="size-3.5" />
          </div>
        </div>
      </div>

      {plugins.length > 0 && (
        <>
          <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--ink-tertiary)">
            <span>插件扩展</span>
          </div>

          <div className="paper-card divide-y divide-dashed divide-(--rule-hairline)/60 overflow-hidden rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) px-3.5 shadow-xs">
            {plugins.map((p) => {
              const isEnabled = enabledPlugins[p.manifest.id] ?? p.manifest.defaultEnabled ?? true;
              return (
                <div
                  key={p.manifest.id}
                  className="flex items-center justify-between py-2.5 select-none"
                >
                  <div className="flex min-w-0 items-center gap-2.5 pr-2">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                      <Blocks className="stroke-1.75 size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-(--ink-primary)">
                          {p.manifest.name}
                        </span>
                        <span className="font-mono text-[10px] text-(--ink-tertiary)">
                          v{p.manifest.version}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] leading-tight text-(--ink-tertiary)">
                        {p.manifest.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'relative h-4.5 w-8 shrink-0 cursor-pointer rounded-full border transition-colors select-none',
                      isEnabled
                        ? 'border-(--ink-primary) bg-(--ink-primary)'
                        : 'border-(--rule-hairline) bg-(--paper-sunken)'
                    )}
                    onClick={() => handleTogglePlugin(p.manifest.id, isEnabled)}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 size-3 rounded-full bg-(--paper-sheet) shadow-2xs transition-transform duration-200',
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

      <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--color-expense) uppercase">
        <span>危险操作</span>
      </div>

      <div className="paper-card overflow-hidden rounded-(--radius-lg) border border-(--color-expense)/30 bg-(--paper-sheet) px-3.5 shadow-xs">
        <div
          className="flex cursor-pointer items-center justify-between py-2.5 select-none"
          onClick={() => setIsClearAllOpen(true)}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--color-expense-bg) text-(--color-expense)">
              <Trash2 className="stroke-1.75 size-3.5" />
            </div>
            <span className="text-[13px] font-medium text-(--color-expense)">清空所有数据</span>
          </div>
          <ChevronRight className="size-3.5 text-(--color-expense)/70" />
        </div>
      </div>

      <PaperModal
        isOpen={isMajorModalOpen}
        onClose={() => setIsMajorModalOpen(false)}
        title="大额阈值"
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {[100, 200, 500, 1000, 2000].map((preset) => {
              const isSelected = Number(majorInput) === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMajorInput(String(preset))}
                  className={cn(
                    'cursor-pointer rounded-(--btn-radius) border px-3 py-1.5 font-mono text-xs transition-all',
                    isSelected
                      ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                      : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  ¥{preset}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs text-(--ink-tertiary)">自定义金额</label>
            <div className="flex h-10 items-center gap-2 rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-3">
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
                className="flex-1 bg-transparent font-mono text-sm font-semibold text-(--ink-primary) outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setIsMajorModalOpen(false)}
              className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveMajorThreshold}
              className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg)"
            >
              保存
            </button>
          </div>
        </div>
      </PaperModal>

      <PaperModal
        isOpen={isBackupConfirmOpen}
        onClose={() => setIsBackupConfirmOpen(false)}
        title="确认全量备份"
      >
        <div className="space-y-4 p-4 select-none">
          <div className="space-y-1.5 rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/70 p-3 font-mono text-xs">
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

          <p className="text-xs leading-relaxed text-(--ink-tertiary)">
            备份文件包含全部流水、账户、分类、偏好配置与插件扩展数据，可用于跨设备迁移或覆盖恢复。
          </p>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setIsBackupConfirmOpen(false)}
              className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isExportingBackup}
              onClick={handleExportJson}
              className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) disabled:opacity-50"
            >
              {isExportingBackup ? '导出中...' : '确认导出备份'}
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
