import React, { useRef, useState } from 'react';
import {
  FileCsv as FileSpreadsheet,
  UploadSimple,
  DownloadSimple,
  CaretRight as ChevronRight,
} from '@phosphor-icons/react';
import { core } from '../../core';
import type { ExportData } from '../../types/adapter';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { toast } from '../../stores/useToastStore';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
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
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; data: ExportData } | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

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
      await loadTransactions();
      await loadSettlementSummary();
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

  return (
    <div className="w-full pb-12 space-y-4 select-none px-4 pt-2">
      <WebDavSyncSection />

      <div className="space-y-1.5">
        <div className="px-1 text-xs font-mono text-(--ink-tertiary) tracking-wider pt-1">
          <span>完整备份与恢复</span>
        </div>

        <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs px-3.5">
          <div
            className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
            onClick={() => setIsBackupConfirmOpen(true)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                <DownloadSimple className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">导出完整备份 (JSON)</span>
            </div>
            <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            className="flex items-center justify-between py-2.5 last:border-b-0 cursor-pointer select-none"
            onClick={() => jsonFileInputRef.current?.click()}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                <UploadSimple className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">恢复完整备份 (JSON)</span>
            </div>
            <div className="text-xs text-(--ink-tertiary) flex items-center gap-1 font-mono">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <input
            ref={jsonFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="px-1 text-xs font-mono text-(--ink-tertiary) tracking-wider pt-1">
          <span>账目导入与导出</span>
        </div>

        <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs px-3.5">
          <div
            className="flex items-center justify-between py-2.5 border-b border-dashed border-(--rule-hairline)/60 cursor-pointer select-none"
            onClick={onOpenImport}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                <UploadSimple className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">导入账本 (向导)</span>
            </div>
            <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            className="flex items-center justify-between py-2.5 last:border-b-0 cursor-pointer select-none"
            onClick={() => setIsExportCsvOpen(true)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary) shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <span className="text-[13px] font-medium text-(--ink-primary)">导出账本 (CSV)</span>
            </div>
            <div className="text-xs text-(--ink-tertiary) flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      <PaperModal
        isOpen={isBackupConfirmOpen}
        onClose={() => setIsBackupConfirmOpen(false)}
        title="导出完整备份"
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-(--ink-secondary) leading-relaxed">
            将导出包含所有账户、流水、分类和系统设置的 JSON 备份文件。
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed border-(--rule-hairline)">
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

      <PaperModal
        isOpen={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        title="确认恢复备份"
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-(--ink-secondary) leading-relaxed">
            确认从文件「{pendingRestore?.fileName}」恢复数据吗？恢复将覆盖当前账本中的所有流水与账户数据，此操作不可撤销。
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed border-(--rule-hairline)">
            <PaperButton
              variant="ghost"
              size="sm"
              onClick={() => setPendingRestore(null)}
              disabled={isRestoringBackup}
            >
              取消
            </PaperButton>
            <PaperButton
              variant="danger"
              size="sm"
              onClick={handleConfirmRestoreJson}
              disabled={isRestoringBackup}
            >
              {isRestoringBackup ? '恢复中...' : '确认覆盖恢复'}
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
