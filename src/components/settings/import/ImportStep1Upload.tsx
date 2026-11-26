import React from 'react';
import {
  UploadSimpleIcon as FileUp,
  CheckIcon as Check,
  ArrowRightIcon as ArrowRight,
  SparkleIcon as Sparkles,
  SlidersIcon as Sliders,
  ChatCircleDotsIcon as ChatCircleDots,
  WalletIcon as Wallet,
} from '@phosphor-icons/react';
import { PaperButton } from '../../ui/PaperButton';
import { PaperChip } from '../../ui/PaperChip';
import { IMPORT_PRESETS } from '../../../domain/import-export/importPresets';
import type { BillSource } from '../../../domain/import-export/billNormalizer';
import { cn } from '../../../utils/cn';

const PRESET_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  wechat: ChatCircleDots,
  alipay: Wallet,
  elephant: Sparkles,
  standard: Sliders,
};

const SOURCE_LABEL_MAP: Record<BillSource, string> = {
  wechat: '微信账单',
  alipay: '支付宝账单',
  elephant: '小象记账',
  standard: '通用表格',
};

export interface ImportStep1UploadProps {
  selectedPresetId: string;
  detectedSource?: BillSource | null;
  onSelectPreset: (presetId: string) => void;
  rowCount: number;
  fileName: string;
  fileCount?: number;
  fileSizeStr: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onNext: () => void;
}

export const ImportStep1Upload: React.FC<ImportStep1UploadProps> = ({
  selectedPresetId,
  detectedSource,
  onSelectPreset,
  rowCount,
  fileName,
  fileCount = 0,
  fileSizeStr,
  fileInputRef,
  onFileChange,
  onCancel,
  onNext,
}) => {
  const displayFileLabel = fileCount > 1 ? `已选 ${fileCount} 个文件` : fileName;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {IMPORT_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const IconComp = PRESET_ICON_MAP[preset.id] || Sliders;
          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-(--radius-md) border p-3.5 transition-all',
                isSelected
                  ? 'border-(--ink-primary) bg-(--paper-sheet) shadow-xs ring-1 ring-(--ink-primary)'
                  : 'border-(--rule-hairline) bg-(--paper-sheet) hover:border-(--ink-tertiary)'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius)',
                    isSelected
                      ? 'bg-(--color-income-bg) text-(--color-income)'
                      : 'bg-(--paper-sunken) text-(--ink-secondary)'
                  )}
                >
                  <IconComp className="stroke-1.8 size-4" />
                </div>
                <div className="min-w-0 flex-1 text-[13px] font-bold text-(--ink-primary)">
                  {preset.name}
                </div>
              </div>
              <div className="text-[11px] leading-relaxed break-words text-(--ink-tertiary)">
                {preset.shortDesc}
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
          multiple
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onFileChange}
          className="hidden"
        />
        {fileName ? (
          <div className="space-y-1.5">
            <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-(--color-income-bg) text-(--color-income)">
              <Check className="stroke-2.2 size-5" />
            </div>
            <div className="text-xs font-bold text-(--ink-primary)">{displayFileLabel}</div>
            {detectedSource && (
              <div className="flex justify-center">
                <PaperChip size="sm" variant="income">
                  已识别：{SOURCE_LABEL_MAP[detectedSource]}
                </PaperChip>
              </div>
            )}
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
            <div className="text-xs font-semibold text-(--ink-primary)">
              点击选择 CSV / XLSX 账单文件
            </div>
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
