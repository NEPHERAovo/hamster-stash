import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UploadSimpleIcon as FileUp, CheckIcon as Check, WarningCircleIcon as AlertCircle, ArrowRightIcon as ArrowRight, ArrowLeftIcon as ArrowLeft, PlusIcon as Plus, SparkleIcon as Sparkles, SlidersIcon as Sliders, ArrowsClockwiseIcon as RefreshCw, FolderSimpleIcon as FolderSync } from '@phosphor-icons/react';
import { PaperButton } from '../ui/PaperButton';
import { parseCsv, type ParsedCsvResult } from '../../domain/import-export/csvParser';
import {
  inferColumnMapping,
  mapConfiguredCsvRows,
  extractCategoriesFromCsv,
  extractTransactionTypesFromCsv,
  type CsvColumnMapping,
  type ExtractedCategoryStat,
  type ExtractedTypeStat,
  type PreparedImportRecord,
} from '../../domain/import-export/csvMapper';
import { IMPORT_PRESETS, type ImportPreset } from '../../domain/import-export/importPresets';
import { useAccountStore } from '../../stores/useAccountStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { toast } from '../../stores/useToastStore';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { useSubPage } from '../layout/SubPageContext';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/date';
import type { TransactionType } from '../../types/transaction';

export interface ImportSubPageProps {
  onClose?: () => void;
  onImportSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

export const ImportSubPage: React.FC<ImportSubPageProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const subPage = useSubPage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      subPage?.requestClose();
    }
  };

  const { accounts, createAccount, loadAccounts } = useAccountStore();
  const { categories, createCategory, loadCategories } = useCategoryStore();
  const { importTransactions } = useLedgerStore();
  const isReimbursementEnabled = usePreferenceStore((s) => s.isReimbursementEnabled);

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('elephant');
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCsvResult>({ headers: [], rows: [] });

  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [typeMapping, setTypeMapping] = useState<Record<string, TransactionType | 'skip'>>({});
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);

  const [defaultAccountId, setDefaultAccountId] = useState<string>('');
  const [autoCreateAccounts, setAutoCreateAccounts] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const activePreset = useMemo<ImportPreset>(() => {
    return IMPORT_PRESETS.find((p) => p.id === selectedPresetId) || IMPORT_PRESETS[0];
  }, [selectedPresetId]);

  const defaultExpenseCat = useMemo(
    () => categories.find((c) => c.type === 'expense')?.id || 'cat_food',
    [categories]
  );
  const defaultIncomeCat = useMemo(
    () => categories.find((c) => c.type === 'income')?.id || 'cat_salary',
    [categories]
  );

  useEffect(() => {
    if (accounts.length > 0 && !defaultAccountId) {
      setDefaultAccountId(accounts[0].id);
    }
  }, [accounts, defaultAccountId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg('');
      const text = await file.text();
      const res = parseCsv(text);

      if (res.headers.length === 0 || res.rows.length === 0) {
        throw new Error('CSV 文件内容为空或未能识别到表格数据');
      }

      setFileName(file.name);
      setFileSizeStr((file.size / 1024).toFixed(1) + ' KB');
      setParsed(res);

      const inferred = inferColumnMapping(res.headers);
      const presetMap = activePreset.defaultMapping || {};

      const mergedMapping: CsvColumnMapping = {
        dateCol: (presetMap.dateCol && res.headers.includes(presetMap.dateCol)) ? presetMap.dateCol : inferred.dateCol,
        amountCol: (presetMap.amountCol && res.headers.includes(presetMap.amountCol)) ? presetMap.amountCol : inferred.amountCol,
        typeCol: (presetMap.typeCol && res.headers.includes(presetMap.typeCol)) ? presetMap.typeCol : inferred.typeCol,
        categoryCol: (presetMap.categoryCol && res.headers.includes(presetMap.categoryCol)) ? presetMap.categoryCol : inferred.categoryCol,
        accountCol: (presetMap.accountCol && res.headers.includes(presetMap.accountCol)) ? presetMap.accountCol : inferred.accountCol,
        noteCol: (presetMap.noteCol && res.headers.includes(presetMap.noteCol)) ? presetMap.noteCol : inferred.noteCol,
        reimburseCol: (presetMap.reimburseCol && res.headers.includes(presetMap.reimburseCol)) ? presetMap.reimburseCol : inferred.reimburseCol,
      };

      setMapping(mergedMapping);
    } catch (err) {
      setErrorMsg('读取文件失败：' + (err instanceof Error ? err.message : '未知格式'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const extractedCategoryStats = useMemo<ExtractedCategoryStat[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return [];
    return extractCategoriesFromCsv(
      parsed.headers,
      parsed.rows,
      mapping.categoryCol,
      mapping.typeCol,
      categories,
      activePreset.categoryAliases || {}
    );
  }, [parsed, mapping.categoryCol, mapping.typeCol, categories, activePreset]);

  const extractedTypeStats = useMemo<ExtractedTypeStat[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0 || !mapping.typeCol) return [];
    return extractTransactionTypesFromCsv(parsed.headers, parsed.rows, mapping.typeCol);
  }, [parsed, mapping.typeCol]);

  useEffect(() => {
    if (currentStep === 3) {
      setCategoryMapping((prev) => {
        const next = { ...prev };
        for (const stat of extractedCategoryStats) {
          if (!next[stat.rawName]) {
            next[stat.rawName] = stat.suggestedCategoryId || (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
          }
        }
        return next;
      });

      setTypeMapping((prev) => {
        const next = { ...prev };
        for (const t of extractedTypeStats) {
          if (!next[t.rawName]) {
            next[t.rawName] = t.suggestedType;
          }
        }
        return next;
      });
    }
  }, [currentStep, extractedCategoryStats, extractedTypeStats, defaultExpenseCat, defaultIncomeCat]);

  const handleCreateCategoryForRaw = async (rawName: string, dominantType: TransactionType) => {
    try {
      setIsCreatingCategory(true);
      const catType = dominantType === 'income' ? 'income' : 'expense';
      const newCat = await createCategory({
        name: rawName,
        type: catType,
      });

      setCategoryMapping((prev) => ({
        ...prev,
        [rawName]: newCat.id,
      }));

      toast.success(`已新建分类「${rawName}」`);
    } catch (err) {
      toast.error('创建分类失败：' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleBatchCreateMissingCategories = async () => {
    try {
      setIsCreatingCategory(true);
      const existingNames = new Set(categories.map((c) => c.name.trim().toLowerCase()));
      let createdCount = 0;
      const newMappingUpdates: Record<string, string> = {};

      for (const stat of extractedCategoryStats) {
        if (!existingNames.has(stat.rawName.toLowerCase())) {
          const catType = stat.dominantType === 'income' ? 'income' : 'expense';
          const newCat = await createCategory({
            name: stat.rawName,
            type: catType,
          });
          newMappingUpdates[stat.rawName] = newCat.id;
          existingNames.add(stat.rawName.toLowerCase());
          createdCount++;
        }
      }

      setCategoryMapping((prev) => ({
        ...prev,
        ...newMappingUpdates,
      }));

      if (createdCount > 0) {
        toast.success(`已新建 ${createdCount} 个分类并完成绑定`);
      } else {
        toast.info('分类均已匹配');
      }
    } catch (err) {
      toast.error('批量新建分类失败：' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const previewData = useMemo<PreparedImportRecord[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0 || !defaultAccountId) {
      return [];
    }
    const sampleRows = parsed.rows.slice(0, 4);
    const { records } = mapConfiguredCsvRows(parsed.headers, sampleRows, {
      mapping,
      categoryMapping,
      typeMapping,
      defaultAccountId,
      defaultExpenseCategoryId: defaultExpenseCat,
      defaultIncomeCategoryId: defaultIncomeCat,
      existingCategories: categories,
      existingAccounts: accounts,
    });
    return records;
  }, [
    parsed,
    mapping,
    categoryMapping,
    typeMapping,
    defaultAccountId,
    defaultExpenseCat,
    defaultIncomeCat,
    categories,
    accounts,
  ]);

  const handleStartImport = async () => {
    if (parsed.rows.length === 0) {
      setErrorMsg('无可用数据');
      return;
    }

    if (!mapping.dateCol || !mapping.amountCol) {
      setErrorMsg('请至少指定「日期」和「金额」列');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');

    try {
      const currentAccounts = [...accounts];

      if (autoCreateAccounts && mapping.accountCol) {
        const acctColIdx = parsed.headers.indexOf(mapping.accountCol);
        if (acctColIdx >= 0) {
          const distinctNames = new Set<string>();
          for (const row of parsed.rows) {
            const val = row[acctColIdx]?.trim();
            if (val) distinctNames.add(val);
          }

          const existingNames = new Set(currentAccounts.map((a) => a.name.trim().toLowerCase()));
          for (const rawName of distinctNames) {
            if (!existingNames.has(rawName.toLowerCase())) {
              const newAcct = await createAccount({
                name: rawName,
                type: rawName.includes('信用') ? 'credit' : 'bank',
                initialBalance: 0,
              });
              currentAccounts.push(newAcct);
              existingNames.add(rawName.toLowerCase());
            }
          }
          await loadAccounts();
        }
      }

      const { records, skippedCount } = mapConfiguredCsvRows(parsed.headers, parsed.rows, {
        mapping,
        categoryMapping,
        typeMapping,
        defaultAccountId,
        defaultExpenseCategoryId: defaultExpenseCat,
        defaultIncomeCategoryId: defaultIncomeCat,
        existingCategories: categories,
        existingAccounts: currentAccounts,
      });

      if (records.length === 0) {
        throw new Error('未解析出有效交易流水');
      }

      const res = await importTransactions(records, true);
      const reimbursableCount = records.filter((r) => r.isReimbursable).length;

      toast.success(
        `成功导入 ${res.importedCount} 笔流水` +
          (skippedCount > 0 ? `（跳过 ${skippedCount} 笔）` : '')
      );

      if (reimbursableCount > 0 && !isReimbursementEnabled) {
        toast.info(
          `导入流水中含 ${reimbursableCount} 笔待报销账单。当前设置中已停用报销功能，可在设置中开启以查看报销状态。`
        );
      }

      await loadCategories();
      onImportSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const getColOptions = () => [
    { label: '（未指定）', value: '' },
    ...parsed.headers.map((h) => ({ label: h, value: h })),
  ];

  return (
    <div className="w-full space-y-4 px-4 pt-1 pb-12 text-(--ink-primary)">
      <div className="rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3 shadow-xs">
        <div className="relative flex items-center justify-between px-2">
          <div className="absolute inset-x-6 top-1/2 z-0 h-px -translate-y-1/2 bg-(--rule-hairline)" />
          {[
            { num: 1, label: '上传文件' },
            { num: 2, label: '字段列' },
            { num: 3, label: '分类匹配' },
            { num: 4, label: '确认导入' },
          ].map((s) => {
            const isDone = currentStep > s.num;
            const isCur = currentStep === s.num;
            let stepBadgeClass = 'bg-(--paper-sunken) text-(--ink-tertiary) border border-(--rule-hairline)';
            if (isDone) {
              stepBadgeClass = 'bg-(--color-income) text-white';
            } else if (isCur) {
              stepBadgeClass = 'bg-(--ink-primary) text-(--paper-sheet)';
            }
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-bold transition-all',
                    stepBadgeClass
                  )}
                >
                  {isDone ? <Check className="stroke-2.5 size-3.5" /> : s.num}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold whitespace-nowrap',
                    isCur ? 'text-(--ink-primary)' : 'text-(--ink-tertiary)'
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-(--radius-sm) border border-(--color-expense)/20 bg-(--color-expense-bg) p-3 text-xs text-(--color-expense)">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {IMPORT_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const IconComp = preset.id === 'elephant' ? Sparkles : Sliders;
              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    if (parsed.headers.length > 0) {
                      const inferred = inferColumnMapping(parsed.headers);
                      const pMap = preset.defaultMapping || {};
                      setMapping({
                        dateCol: (pMap.dateCol && parsed.headers.includes(pMap.dateCol)) ? pMap.dateCol : inferred.dateCol,
                        amountCol: (pMap.amountCol && parsed.headers.includes(pMap.amountCol)) ? pMap.amountCol : inferred.amountCol,
                        typeCol: (pMap.typeCol && parsed.headers.includes(pMap.typeCol)) ? pMap.typeCol : inferred.typeCol,
                        categoryCol: (pMap.categoryCol && parsed.headers.includes(pMap.categoryCol)) ? pMap.categoryCol : inferred.categoryCol,
                        accountCol: (pMap.accountCol && parsed.headers.includes(pMap.accountCol)) ? pMap.accountCol : inferred.accountCol,
                        noteCol: (pMap.noteCol && parsed.headers.includes(pMap.noteCol)) ? pMap.noteCol : inferred.noteCol,
                        reimburseCol: (pMap.reimburseCol && parsed.headers.includes(pMap.reimburseCol)) ? pMap.reimburseCol : inferred.reimburseCol,
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
              onChange={handleFileChange}
              className="hidden"
            />
            {fileName ? (
              <div className="space-y-1.5">
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-(--color-income-bg) text-(--color-income)">
                  <Check className="stroke-2.2 size-5" />
                </div>
                <div className="text-xs font-bold text-(--ink-primary)">{fileName}</div>
                <div className="font-mono text-[11px] text-(--ink-tertiary)">
                  {fileSizeStr} · 共 {parsed.rows.length} 行
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="cursor-pointer pt-1 text-xs text-(--color-income) hover:underline"
                >
                  更换文件
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-(--paper-sunken) text-(--ink-secondary)">
                  <FileUp className="stroke-1.8 size-5" />
                </div>
                <div className="text-xs font-semibold text-(--ink-primary)">
                  点击选择 CSV 文件
                </div>
                <div className="text-[11px] text-(--ink-tertiary)">
                  支持 UTF-8 / GBK 编码
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <PaperButton variant="secondary" size="sm" onClick={handleClose}>
              取消
            </PaperButton>
            <PaperButton
              variant="ink"
              size="sm"
              disabled={parsed.rows.length === 0}
              onClick={() => setCurrentStep(2)}
            >
              <span>下一步：确认字段</span>
              <ArrowRight className="ml-1 size-3.5" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="divide-y divide-(--rule-hairline) rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-xs shadow-xs">
            {[
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
            ].map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div>
                  <div className="flex items-center gap-1 font-semibold text-(--ink-primary)">
                    {field.required && <span className="text-(--color-expense)">*</span>}
                    {field.label}
                  </div>
                  <div className="text-[10px] text-(--ink-tertiary)">{field.desc}</div>
                </div>
                <select
                  value={(mapping as Record<string, string | undefined>)[field.key] || ''}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      [field.key]: e.target.value || undefined,
                    })
                  }
                  className="max-w-40 cursor-pointer rounded-(--radius-xs) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 py-1.5 text-xs text-(--ink-primary) outline-none focus:border-(--ink-primary)"
                >
                  {getColOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <PaperButton variant="secondary" size="sm" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="mr-1 size-3.5" />
              <span>上一步</span>
            </PaperButton>
            <PaperButton
              variant="ink"
              size="sm"
              disabled={!mapping.dateCol || !mapping.amountCol}
              onClick={() => {
                if (!mapping.dateCol || !mapping.amountCol) {
                  setErrorMsg('请至少指定「日期」和「金额」列');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(3);
              }}
            >
              <span>下一步：分类匹配</span>
              <ArrowRight className="ml-1 size-3.5" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3 text-xs shadow-xs">
            <span className="text-[11px] text-(--ink-secondary)">
              共解析出 {extractedCategoryStats.length} 个分类
            </span>
            <button
              type="button"
              onClick={handleBatchCreateMissingCategories}
              disabled={isCreatingCategory}
              className="flex cursor-pointer items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 py-1 text-xs font-semibold text-(--ink-primary) transition-all hover:bg-(--paper-hover) active:scale-95"
            >
              <Plus className="size-3 text-(--color-income)" />
              <span>批量新建未匹配分类</span>
            </button>
          </div>

          {extractedCategoryStats.length === 0 ? (
            <div className="rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) py-8 text-center text-xs text-(--ink-tertiary)">
              未指定分类列，将统一使用默认分类入库。
            </div>
          ) : (
            <div className="max-h-90 divide-y divide-(--rule-hairline) overflow-hidden overflow-y-auto rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
              {extractedCategoryStats.map((stat) => {
                const currentMappedCatId =
                  categoryMapping[stat.rawName] ||
                  stat.suggestedCategoryId ||
                  (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
                const isExactExistInSystem = categories.some(
                  (c) => c.name.trim().toLowerCase() === stat.rawName.trim().toLowerCase()
                );

                return (
                  <div key={stat.rawName} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                    <div className="flex min-w-20 shrink-0 items-center gap-1.5">
                      <span className="max-w-25 truncate font-semibold text-(--ink-primary)">
                        {stat.rawName}
                      </span>
                      <span className="text-[10px] text-(--ink-tertiary) tabular-nums">
                        ({stat.count})
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <ArrowRight className="size-3.5 shrink-0 text-(--ink-tertiary)" />
                      <select
                        value={currentMappedCatId}
                        onChange={(e) =>
                          setCategoryMapping({
                            ...categoryMapping,
                            [stat.rawName]: e.target.value,
                          })
                        }
                        className="min-w-0 flex-1 cursor-pointer rounded-(--radius-xs) border border-(--rule-hairline) bg-(--paper-sunken) px-2 py-1 text-xs text-(--ink-primary) outline-none focus:border-(--ink-primary)"
                      >
                        <optgroup label="支出">
                          {categories.filter((c) => c.type === 'expense').map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="收入">
                          {categories.filter((c) => c.type === 'income').map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {!isExactExistInSystem && (
                      <button
                        type="button"
                        onClick={() => handleCreateCategoryForRaw(stat.rawName, stat.dominantType)}
                        disabled={isCreatingCategory}
                        className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded-(--radius-xs) border border-(--rule-hairline) bg-(--paper-sunken) px-2 py-1 text-[11px] font-semibold text-(--ink-secondary) hover:text-(--ink-primary)"
                        title="新建分类"
                      >
                        <Plus className="size-3 text-(--color-income)" />
                        <span>新建</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {extractedTypeStats.length > 0 && (
            <div className="divide-y divide-(--rule-hairline) rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-xs shadow-xs">
              {extractedTypeStats.map((t) => {
                const currentMappedType = typeMapping[t.rawName] || t.suggestedType;
                return (
                  <div key={t.rawName} className="flex items-center justify-between gap-2 p-2.5">
                    <span className="font-semibold text-(--ink-primary)">
                      {t.rawName} <span className="text-[10px] text-(--ink-tertiary)">({t.count}笔)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="size-3.5 text-(--ink-tertiary)" />
                      <select
                        value={currentMappedType}
                        onChange={(e) =>
                          setTypeMapping({
                            ...typeMapping,
                            [t.rawName]: e.target.value as TransactionType | 'skip',
                          })
                        }
                        className="cursor-pointer rounded-(--radius-xs) border border-(--rule-hairline) bg-(--paper-sunken) px-2 py-1 text-xs text-(--ink-primary) outline-none focus:border-(--ink-primary)"
                      >
                        <option value="expense">支出</option>
                        <option value="income">收入</option>
                        <option value="transfer">转账</option>
                        <option value="loan">借贷</option>
                        <option value="skip">跳过</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <PaperButton variant="secondary" size="sm" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="mr-1 size-3.5" />
              <span>上一步</span>
            </PaperButton>
            <PaperButton variant="ink" size="sm" onClick={() => setCurrentStep(4)}>
              <span>下一步：确认导入</span>
              <ArrowRight className="ml-1 size-3.5" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 text-xs shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="block font-semibold text-(--ink-primary)">默认入账账户</span>
                <span className="text-[10px] text-(--ink-tertiary)">未指定账户时归属此项</span>
              </div>
              <select
                value={defaultAccountId}
                onChange={(e) => setDefaultAccountId(e.target.value)}
                className="max-w-40 cursor-pointer rounded-(--radius-xs) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 py-1.5 text-xs text-(--ink-primary) outline-none focus:border-(--ink-primary)"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 border-t border-(--rule-hairline) pt-2.5">
              <input
                type="checkbox"
                checked={autoCreateAccounts}
                onChange={(e) => setAutoCreateAccounts(e.target.checked)}
                className="rounded text-(--ink-primary)"
              />
              <span className="font-semibold text-(--ink-primary)">
                自动创建表格中出现的新账户
              </span>
            </label>
          </div>

          {previewData.some((r) => r.isReimbursable) && !isReimbursementEnabled && (
            <div className="flex items-center gap-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken) p-2.5 text-[11px] text-(--ink-secondary)">
              <AlertCircle className="size-3.5 shrink-0 text-(--ink-tertiary)" />
              <span>表格中包含待报销流水。当前设置中已停用报销功能，导入后可随时在设置中开启报销查看。</span>
            </div>
          )}

          <div className="divide-y divide-(--rule-hairline) overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
            <div className="bg-(--paper-sunken) px-3.5 py-2 text-[11px] font-semibold text-(--ink-tertiary)">
              数据预览 (前 {previewData.length} 笔)
            </div>
            {previewData.map((rec, i) => {
              const cat = categories.find((c) => c.id === rec.categoryId);
              const acct = accounts.find((a) => a.id === rec.accountId);
              const Icon = getCategoryIcon(cat?.icon || 'shopping-cart');
              const formattedTime = formatTime(rec.createdAt);
              const timePart = formattedTime ? ` ${formattedTime}` : '';

              return (
                <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                      <Icon className="stroke-1.8 size-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-(--ink-primary)">{cat?.name || '默认'}</div>
                      <div className="font-mono text-[10px] text-(--ink-tertiary)">
                        {rec.date}{timePart} · {rec.rawAccountName || acct?.name || '默认'}
                        {rec.note && ` · ${rec.note}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-bold tabular-nums',
                        rec.type === 'income' ? 'text-(--color-income)' : 'text-(--color-expense)'
                      )}
                    >
                      {rec.type === 'income' ? '+' : '-'} ¥{centsToYuan(rec.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <PaperButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(3)}
              disabled={isImporting}
            >
              <ArrowLeft className="mr-1 size-3.5" />
              <span>上一步</span>
            </PaperButton>
            <PaperButton
              variant="ink"
              size="sm"
              disabled={isImporting || parsed.rows.length === 0}
              onClick={handleStartImport}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="mr-1 size-3.5 animate-spin" />
                  <span>导入中...</span>
                </>
              ) : (
                <>
                  <FolderSync className="mr-1 size-3.5" />
                  <span>确认导入 ({parsed.rows.length} 笔)</span>
                </>
              )}
            </PaperButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportSubPage;
