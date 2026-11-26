import React from 'react';
import { ArrowLeftIcon as ArrowLeft, ArrowRightIcon as ArrowRight } from '@phosphor-icons/react';
import { PaperButton } from '../../ui/PaperButton';
import { PaperSelect } from '../../ui/PaperSelect';
import { PaperSwitch } from '../../ui/PaperSwitch';
import type { CsvColumnMapping } from '../../../domain/import-export/csvMapper';
import type { BillSource } from '../../../domain/import-export/billNormalizer';

export interface ImportStep2ColumnsProps {
  headers: string[];
  mapping: CsvColumnMapping;
  onChangeMapping: (mapping: CsvColumnMapping) => void;
  isReimbursementEnabled: boolean;
  detectedSource?: BillSource | null;
  skipClosedAndFullRefunds?: boolean;
  onChangeSkipClosedAndFullRefunds?: (checked: boolean) => void;
  skipDuplicates?: boolean;
  onChangeSkipDuplicates?: (checked: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const ImportStep2Columns: React.FC<ImportStep2ColumnsProps> = ({
  headers,
  mapping,
  onChangeMapping,
  isReimbursementEnabled,
  detectedSource,
  skipClosedAndFullRefunds = true,
  onChangeSkipClosedAndFullRefunds,
  skipDuplicates = true,
  onChangeSkipDuplicates,
  onPrev,
  onNext,
}) => {
  const colOptions = [
    { label: '（未指定）', value: '' },
    ...headers.map((h) => ({ label: h, value: h })),
  ];

  const isBillPlatform = detectedSource === 'wechat' || detectedSource === 'alipay';

  const fields = [
    { key: 'dateCol', label: '日期时间列', required: true, desc: '交易发生时间' },
    { key: 'amountCol', label: '金额列', required: true, desc: '交易金额数值' },
    { key: 'typeCol', label: '收支类型列', required: false, desc: '支出 / 收入' },
    { key: 'categoryCol', label: '分类名称列', required: false, desc: '账单分类名称' },
    { key: 'accountCol', label: '账户渠道列', required: false, desc: '支付方式 / 账户' },
    { key: 'noteCol', label: '备注说明列', required: false, desc: '商户或备注信息' },
    {
      key: 'reimburseCol',
      label: '是否报销列',
      required: false,
      desc: !isReimbursementEnabled ? '报销标记（设置中已停用报销）' : '报销标记',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="divide-y divide-(--rule-hairline) rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-xs shadow-xs">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-1 font-semibold text-(--ink-primary)">
                {field.required && <span className="text-(--color-expense)">*</span>}
                {field.label}
              </div>
              <div className="text-[10px] text-(--ink-tertiary)">{field.desc}</div>
            </div>
            <PaperSelect
              value={(mapping as Record<string, string | undefined>)[field.key] || ''}
              onChange={(e) =>
                onChangeMapping({
                  ...mapping,
                  [field.key]: e.target.value || undefined,
                })
              }
              containerClassName="max-w-40"
              className="bg-(--paper-sunken)"
            >
              {colOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </PaperSelect>
          </div>
        ))}
      </div>

      {isBillPlatform && onChangeSkipClosedAndFullRefunds && onChangeSkipDuplicates && (
        <div className="divide-y divide-(--rule-hairline) rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-xs shadow-xs">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="font-semibold text-(--ink-primary)">过滤已关闭与全额退款</span>
            <PaperSwitch
              checked={skipClosedAndFullRefunds}
              onChange={onChangeSkipClosedAndFullRefunds}
              aria-label="过滤已关闭与全额退款"
            />
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="font-semibold text-(--ink-primary)">跳过已导入的重复账单</span>
            <PaperSwitch
              checked={skipDuplicates}
              onChange={onChangeSkipDuplicates}
              aria-label="跳过已导入的重复账单"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <PaperButton variant="secondary" size="sm" onClick={onPrev}>
          <ArrowLeft className="mr-1 size-3.5" />
          <span>上一步</span>
        </PaperButton>
        <PaperButton
          variant="ink"
          size="sm"
          disabled={!mapping.dateCol || !mapping.amountCol}
          onClick={onNext}
        >
          <span>下一步：分类匹配</span>
          <ArrowRight className="ml-1 size-3.5" />
        </PaperButton>
      </div>
    </div>
  );
};
