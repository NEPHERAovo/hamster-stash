import React, { useState } from 'react';
import { SlidersHorizontalIcon as SlidersHorizontal, ReceiptIcon as ReceiptText, CalendarCheckIcon as CalendarClock, TagIcon as Tags, DatabaseIcon as Database, SquaresFourIcon as Blocks, TrashIcon as Trash2, ArrowsClockwiseIcon as RefreshCw, DownloadSimpleIcon as Download, FlaskIcon as Flask } from '@phosphor-icons/react';
import { dataLifecycleService } from '../../domain/data/dataLifecycleService';
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
import { PaperButton } from '../ui/PaperButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperChip } from '../ui/PaperChip';
import { SettingSection, SettingRow } from '../ui/SettingList';
import { ClearAllDataModal } from './ClearAllDataModal';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';
import { pluginManager } from '../../core/plugin/PluginManager';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { cn } from '../../utils/cn';

export interface SettingsCardProps {
  onOpenImport?: () => void;
  onOpenCategories?: () => void;
  onOpenDataManage?: () => void;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  onOpenCategories,
  onOpenDataManage,
}) => {
  const { accounts, loadAccounts } = useAccountStore();
  const { transactions, loadTransactions, loadSettlementSummary } = useLedgerStore();
  const { loadCategories } = useCategoryStore();
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
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
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
      } else {
        await pluginManager.enablePlugin(id);
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

  const handleClearAllData = async () => {
    await dataLifecycleService.clearAllData();

    await loadAccounts();
    await loadCategories();
    await loadTransactions();
    await loadSettlementSummary();
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

      <SettingSection title="设置" uppercase>
        <SettingRow
          icon={<Tags className="stroke-1.75 size-3.5" />}
          title="分类管理"
          onClick={onOpenCategories}
          chevron
        />
        <SettingRow
          icon={<SlidersHorizontal className="stroke-1.75 size-3.5" />}
          title="大额阈值"
          value={<span>≥ ¥{majorThresholdYuan}</span>}
          onClick={openMajorModal}
          chevron
        />
        <SettingRow
          icon={<ReceiptText className="stroke-1.75 size-3.5" />}
          title="报销功能"
          right={
            <PaperSwitch
              checked={isReimbursementEnabled}
              onChange={(checked) => setReimbursementEnabled(checked)}
              aria-label="报销功能"
            />
          }
        />
        <SettingRow
          icon={<CalendarClock className="stroke-1.75 size-3.5" />}
          title="分期支出"
          right={
            <PaperSwitch
              checked={isAmortizationEnabled}
              onChange={(checked) => setAmortizationEnabled(checked)}
              aria-label="分期支出"
            />
          }
        />
        <SettingRow
          icon={<Flask className="stroke-1.75 size-3.5" />}
          title="沙盒测试模式"
          right={
            <div className="flex items-center gap-2">
              {isSandboxModeActive() && (
                <PaperButton
                  variant="ghost"
                  size="xs"
                  onClick={() => void resetSandboxData()}
                >
                  重置演示数据
                </PaperButton>
              )}
              <PaperSwitch
                checked={isSandboxModeActive()}
                onChange={(checked) => setSandboxMode(checked)}
                aria-label="沙盒测试模式"
              />
            </div>
          }
        />
        <SettingRow
          icon={<Database className="stroke-1.75 size-3.5" />}
          title="数据与备份"
          onClick={onOpenDataManage}
          chevron
        />
        {!isInstalled && (
          <SettingRow
            icon={<Download className="stroke-1.75 size-3.5" />}
            title="添加到桌面"
            value={
              installPrompt ? (
                <span className="rounded-full bg-(--color-income-bg) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-income)">
                  直接安装
                </span>
              ) : (
                <span>安装指引</span>
              )
            }
            onClick={handleInstallClick}
            chevron
          />
        )}
        <SettingRow
          icon={<RefreshCw className={cn('stroke-1.75 size-3.5', isChecking && 'animate-spin')} />}
          title="检查更新"
          value={
            <>
              {needRefresh && (
                <span className="rounded-full bg-(--color-income-bg) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-income)">
                  有新版本
                </span>
              )}
              {isChecking && <span>检查中...</span>}
            </>
          }
          chevron
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
        />
        <div>
          <SettingRow
            className="py-3"
            icon={
              <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-(--badge-radius) border border-(--rule-hairline) bg-(--paper-sunken)">
                <img src="/pwa-64x64.png" alt="仓鼠囤囤" className="size-full object-cover" />
              </div>
            }
            title="关于"
            value={<span>v0.2.2</span>}
            chevron
            onClick={() => setIsAboutExpanded((prev) => !prev)}
          />
          {isAboutExpanded && (
            <p className="pb-2.5 pl-8.5 font-mono text-[11px] leading-relaxed text-(--ink-tertiary)">
              集日常收支、物品收纳与资产管理于一体的本地优先个人账本。
            </p>
          )}
        </div>
      </SettingSection>

      {plugins.length > 0 && (
        <SettingSection title="插件扩展">
          {plugins.map((p) => {
            const isEnabled = enabledPlugins[p.manifest.id] ?? p.manifest.defaultEnabled ?? true;
            return (
              <SettingRow
                key={p.manifest.id}
                icon={<Blocks className="stroke-1.75 size-3.5" />}
                title={
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{p.manifest.name}</span>
                    <span className="font-mono text-[10px] text-(--ink-tertiary)">
                      v{p.manifest.version}
                    </span>
                  </div>
                }
                description={p.manifest.description}
                right={
                  <PaperSwitch
                    checked={isEnabled}
                    onChange={() => handleTogglePlugin(p.manifest.id, isEnabled)}
                    aria-label={p.manifest.name}
                  />
                }
              />
            );
          })}
        </SettingSection>
      )}

      <PluginSlot name="settings.sections" />

      <SettingSection title="危险操作" uppercase danger>
        <SettingRow
          icon={<Trash2 className="stroke-1.75 size-3.5" />}
          title="清空所有数据"
          danger
          chevron
          onClick={() => setIsClearAllOpen(true)}
        />
      </SettingSection>

      <PaperModal
        isOpen={isMajorModalOpen}
        onClose={() => setIsMajorModalOpen(false)}
        title="大额阈值"
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {[100, 200, 500, 1000, 2000].map((preset) => (
              <PaperChip
                key={preset}
                selected={Number(majorInput) === preset}
                onClick={() => setMajorInput(String(preset))}
              >
                ¥{preset}
              </PaperChip>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs text-(--ink-tertiary)">自定义金额</label>
            <PaperInput
              type="number"
              inputMode="numeric"
              min={1}
              value={majorInput}
              onChange={(e) => setMajorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.key === 'Process' || e.keyCode === 229) return;
                if (e.key === 'Enter') handleSaveMajorThreshold();
              }}
              placeholder="输入金额"
              leftIcon={<span className="font-mono text-sm text-(--ink-tertiary)">¥</span>}
              inputClassName="font-mono font-semibold"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <PaperButton
              type="button"
              variant="sunken"
              className="flex-1"
              onClick={() => setIsMajorModalOpen(false)}
            >
              取消
            </PaperButton>
            <PaperButton
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleSaveMajorThreshold}
            >
              保存
            </PaperButton>
          </div>
        </div>
      </PaperModal>

      <ClearAllDataModal
        isOpen={isClearAllOpen}
        transactionCount={transactions.length}
        accountCount={accounts.length}
        onClose={() => setIsClearAllOpen(false)}
        onRequestBackup={() => {
          setIsClearAllOpen(false);
          onOpenDataManage?.();
        }}
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
