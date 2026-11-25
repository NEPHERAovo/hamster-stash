import React from 'react';
import {
  UploadSimpleIcon as FileUp,
  CheckIcon as Check,
  ArrowRightIcon as ArrowRight,
  SparkleIcon as Sparkles,
  SlidersIcon as Sliders,
} from '@phosphor-icons/react';
import { PaperButton } from '../../ui/PaperButton';
import { inferColumnMapping, type CsvColumnMapping } from '../../../domain/import-export/csvMapper';
import { IMPORT_PRESETS } from '../../../domain/import-export/importPresets';
import { cn } from '../../../utils/cn';

export interface ImportStep1UploadProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  headers: string[];
  rowCount: number;
  onUpdateMapping: (mapping: CsvColumnMapping) => void;
  fileName: string;
  fileSizeStr: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onNext: () => void;
}

export const ImportStep1Upload: React.FC<ImportStep1UploadProps> = ({
  selectedPresetId,
  onSelectPreset,
  headers,
  rowCount,
  onUpdateMapping,
  fileName,
  fileSizeStr,
  fileInputRef,
  onFileChange,
  onCancel,
  onNext,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {IMPORT_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const IconComp = preset.id === 'elephant' ? Sparkles : Sliders;
          return (
            <div
              key={preset.id}
              onClick={() => {
                onSelectPreset(preset.id);
                if (headers.length > 0) {
                  const inferred = inferColumnMapping(headers);
                  const pMap = preset.defaultMapping || {};
                  onUpdateMapping({
                    dateCol: pMap.dateCol && headers.includes(pMap.dateCol) ? pMap.dateCol : inferred.dateCol,
                    amountCol: pMap.amountCol && headers.includes(pMap.amountCol) ? pMap.amountCol : inferred.amountCol,
                    typeCol: pMap.typeCol && headers.includes(pMap.typeCol) ? pMap.typeCol : inferred.typeCol,
                    categoryCol: pMap.categoryCol && headers.includes(pMap.categoryCol) ? pMap.categoryCol : inferred.categoryCol,
                    accountCol: pMap.accountCol && headers.includes(pMap.accountCol) ? pMap.accountCol : inferred.accountCol,
                    noteCol: pMap.noteCol && headers.includes(pMap.noteCol) ? pMap.noteCol : inferred.noteCol,
                    reimburseCol: pMap.reimburseCol && headers.includes(pMap.reimburseCol) ? pMap.reimburseCol : inferred.reimburseCol,
                  });
                }
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-(--radius-md) border p-3.5 transition-all',
                isSelected
                  ? 'border-(--ink-primary) bg-(--paper-sheet) shadow-xs ring-1 ring-(--ink-primary)'
                  : 'border-(--rule-hairline) bg-(--paper-sheet) hover:border-(--ink-tertiary)'
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-(--badge-radius)',
                  isSelected ? 'bg-(--color-income-bg) text-(--color-income)' : 'bg-(--paper-sunken) text-(--ink-secondary)'
                )}
              >
                <IconComp className="stroke-1.8 size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-(--ink-primary)">{preset.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-(--ink-tertiary)">{preset.shortDesc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-(--radius-md) border-2 border-dashed bg-(--paper-sheet) px-4 py-8 text-center transition-all',
          fileName
            ? 'border-(--color-income)'
            : 'border-(--rule-hairline) hover:border-(--ink-tertiary) hover:bg-(--paper-hover)/40'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="hidden"
        />
        {fileName ? (
          <div className="space-y-1.5">
            <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-(--color-income-bg) text-(--color-income)">
              <Check className="stroke-2.2 size-5" />
            </div>
            <div className="text-xs font-bold text-(--ink-primary)">{fileName}</div>
            <div className="font-mono text-[11px] text-(--ink-tertiary)">
              {fileSizeStr} · 共 {rowCount} 行
            </div>
            <PaperButton
              variant="income"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              更换文件
            </PaperButton>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-(--paper-sunken) text-(--ink-secondary)">
              <FileUp className="stroke-1.8 size-5" />
            </div>
            <div className="text-xs font-semibold text-(--ink-primary)">点击选择 CSV 文件</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <PaperButton variant="secondary" size="sm" onClick={onCancel}>
          取消
        </PaperButton>
        <PaperButton variant="ink" size="sm" disabled={rowCount === 0} onClick={onNext}>
          <span>下一步：确认字段</span>
          <ArrowRight className="ml-1 size-3.5" />
        </PaperButton>
      </div>
    </div>
  );
};
