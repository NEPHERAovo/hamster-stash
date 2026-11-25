import React, { useRef, useState } from 'react';
import { FileCsvIcon as FileSpreadsheet, UploadSimpleIcon as UploadSimple, DownloadSimpleIcon as DownloadSimple } from '@phosphor-icons/react';
import { dataLifecycleService } from '../../domain/data/dataLifecycleService';
import type { ExportData } from '../../types/adapter';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { SettingSection, SettingRow } from '../ui/SettingList';
import { ExportCsvModal } from './ExportCsvModal';
import { WebDavSyncSection } from './WebDavSyncSection';
import { todayDate } from '../../utils/date';

export interface DataManageSubPageProps {
  onOpenImport?: () => void;
}

export const DataManageSubPage: React.FC<DataManageSubPageProps> = ({
  onOpenImport,
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const { loadAccounts } = useAccountStore();
  const { loadMonth, loadTransactions, loadSettlementSummary } = useLedgerStore();
  const { loadCategories } = useCategoryStore();

  const [isExportCsvOpen, setIsExportCsvOpen] = useState(false);
  const [isBackupConfirmOpen, setIsBackupConfirmOpen] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  const handleExportJson = async () => {
    setIsExportingBackup(true);
    try {
      const exportData = await dataLifecycleService.exportData();
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

      const confirmed = await confirmAction({
        title: '确认恢复备份',
        message: `确认从文件「${file.name}」恢复数据吗？恢复将覆盖当前账本中的所有流水与账户数据，此操作不可撤销。`,
        confirmText: '确认覆盖恢复',
        cancelText: '取消',
        isDestructive: true,
      });

      if (!confirmed) return;

      await dataLifecycleService.restoreBackup(data);

      await loadAccounts();
      await loadCategories();
      await loadMonth();
      await loadTransactions();
      await loadSettlementSummary();
      await useThemeStore.getState().loadThemeFromDB();
      await usePreferenceStore.getState().loadPreferencesFromDB();

      toast.success('JSON 数据恢复成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复备份数据失败');
    } finally {
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-4 px-4 pt-2 pb-12 select-none">
      <WebDavSyncSection />

      <SettingSection title="完整备份与恢复">
        <SettingRow
          icon={<DownloadSimple className="stroke-1.75 size-3.5" />}
          title="导出完整备份"
          onClick={() => setIsBackupConfirmOpen(true)}
          chevron
        />
        <SettingRow
          icon={<UploadSimple className="stroke-1.75 size-3.5" />}
          title="恢复完整备份"
          onClick={() => jsonFileInputRef.current?.click()}
          chevron
        />
        <input
          ref={jsonFileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJson}
          className="hidden"
        />
      </SettingSection>

      <SettingSection title="账目导入与导出">
        <SettingRow
          icon={<UploadSimple className="stroke-1.75 size-3.5" />}
          title="导入账本"
          onClick={onOpenImport}
          chevron
        />
        <SettingRow
          icon={<FileSpreadsheet className="stroke-1.75 size-3.5" />}
          title="导出账本"
          onClick={() => setIsExportCsvOpen(true)}
          chevron
        />
      </SettingSection>

      <PaperModal
        isOpen={isBackupConfirmOpen}
        onClose={() => setIsBackupConfirmOpen(false)}
        title="导出完整备份"
      >
        <div className="space-y-4 p-4">
          <p className="text-xs leading-relaxed text-(--ink-secondary)">
            将导出包含所有账户、流水、分类和系统设置的 JSON 备份文件。
          </p>
          <div className="flex items-center justify-end gap-2 border-t border-dashed border-(--rule-hairline) pt-2">
            <PaperButton
              variant="ghost"
              size="sm"
              onClick={() => setIsBackupConfirmOpen(false)}
              disabled={isExportingBackup}
            >
              取消
            </PaperButton>
            <PaperButton
              variant="primary"
              size="sm"
              onClick={handleExportJson}
              disabled={isExportingBackup}
            >
              {isExportingBackup ? '导出中...' : '确认导出'}
            </PaperButton>
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

export default DataManageSubPage;
