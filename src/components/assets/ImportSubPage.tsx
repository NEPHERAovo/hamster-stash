import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileUp,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Sparkles,
  Sliders,
  RefreshCw,
  FolderSync,
} from 'lucide-react';
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
import { toast } from '../../stores/useToastStore';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { useSubPage } from '../layout/SubPageContext';
import { cn } from '../../utils/cn';
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
      toast.success(
        `成功导入 ${res.importedCount} 笔流水` +
          (skippedCount > 0 ? `（跳过 ${skippedCount} 笔）` : '')
      );

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
    <div className="w-full pb-12 pt-1 px-4 text-(--ink-primary) space-y-4">
      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-3 shadow-xs">
        <div className="flex items-center justify-between relative px-2">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[1px] bg-(--rule-hairline) z-0" />
          {[
            { num: 1, label: '上传文件' },
            { num: 2, label: '字段列' },
            { num: 3, label: '分类匹配' },
            { num: 4, label: '确认导入' },
          ].map((s) => {
            const isDone = currentStep > s.num;
            const isCur = currentStep === s.num;
            return (
              <div key={s.num} className="flex flex-col items-center gap-1 relative z-10">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isDone
                      ? 'bg-(--color-income) text-white'
                      : isCur
                      ? 'bg-(--ink-primary) text-(--paper-sheet)'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) border border-(--rule-hairline)'
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.num}
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
        <div className="p-3 rounded-(--radius-sm) bg-(--color-expense-bg) text-(--color-expense) text-xs flex items-center gap-2 border border-(--color-expense)/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
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
                    'p-3.5 rounded-(--radius-md) border transition-all cursor-pointer flex items-center gap-3',
                    isSelected
                      ? 'bg-(--paper-sheet) border-(--ink-primary) ring-1 ring-(--ink-primary) shadow-xs'
                      : 'bg-(--paper-sheet) border-(--rule-hairline) hover:border-(--ink-tertiary)'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-(--badge-radius) flex items-center justify-center shrink-0',
                      isSelected ? 'bg-(--color-income-bg) text-(--color-income)' : 'bg-(--paper-sunken) text-(--ink-secondary)'
                    )}
                  >
                    <IconComp className="w-4 h-4 stroke-[1.8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[13px] text-(--ink-primary)">{preset.name}</div>
                    <div className="text-[11px] text-(--ink-tertiary) truncate mt-0.5">{preset.shortDesc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-(--radius-md) py-8 px-4 text-center cursor-pointer transition-all bg-(--paper-sheet)',
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
                <div className="w-9 h-9 rounded-full bg-(--color-income-bg) text-(--color-income) flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="font-bold text-xs text-(--ink-primary)">{fileName}</div>
                <div className="text-[11px] font-mono text-(--ink-tertiary)">
                  {fileSizeStr} · 共 {parsed.rows.length} 行
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-(--color-income) hover:underline cursor-pointer pt-1"
                >
                  更换文件
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-full bg-(--paper-sunken) text-(--ink-secondary) flex items-center justify-center mx-auto">
                  <FileUp className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div className="font-semibold text-xs text-(--ink-primary)">
                  点击选择 CSV 文件
                </div>
                <div className="text-[11px] text-(--ink-tertiary)">
                  支持 UTF-8 / GBK 编码
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
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
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) divide-y divide-(--rule-hairline) shadow-xs text-xs">
            {[
              { key: 'dateCol', label: '日期时间列', required: true, desc: '交易发生时间' },
              { key: 'amountCol', label: '金额列', required: true, desc: '交易金额数值' },
              { key: 'typeCol', label: '收支类型列', required: false, desc: '支出 / 收入' },
              { key: 'categoryCol', label: '分类名称列', required: false, desc: '账单分类名称' },
              { key: 'accountCol', label: '账户渠道列', required: false, desc: '支付方式 / 账户' },
              { key: 'noteCol', label: '备注说明列', required: false, desc: '商户或备注信息' },
              { key: 'reimburseCol', label: '是否报销列', required: false, desc: '报销标记' },
            ].map((field) => (
              <div key={field.key} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-(--ink-primary) flex items-center gap-1">
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
                  className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--ink-primary) cursor-pointer max-w-[160px]"
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

          <div className="pt-2 flex items-center justify-between">
            <PaperButton variant="secondary" size="sm" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
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
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-3 shadow-xs flex items-center justify-between gap-3 text-xs">
            <span className="text-[11px] text-(--ink-secondary)">
              共解析出 {extractedCategoryStats.length} 个分类
            </span>
            <button
              type="button"
              onClick={handleBatchCreateMissingCategories}
              disabled={isCreatingCategory}
              className="px-2.5 py-1 rounded-(--btn-radius) bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-primary) text-xs font-semibold flex items-center gap-1 border border-(--rule-hairline) cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-3 h-3 text-(--color-income)" />
              <span>批量新建未匹配分类</span>
            </button>
          </div>

          {extractedCategoryStats.length === 0 ? (
            <div className="text-center py-8 bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) text-xs text-(--ink-tertiary)">
              未指定分类列，将统一使用默认分类入库。
            </div>
          ) : (
            <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) divide-y divide-(--rule-hairline) shadow-xs overflow-hidden max-h-[360px] overflow-y-auto">
              {extractedCategoryStats.map((stat) => {
                const currentMappedCatId =
                  categoryMapping[stat.rawName] ||
                  stat.suggestedCategoryId ||
                  (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
                const isExactExistInSystem = categories.some(
                  (c) => c.name.trim().toLowerCase() === stat.rawName.trim().toLowerCase()
                );

                return (
                  <div key={stat.rawName} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-[80px] shrink-0">
                      <span className="font-semibold text-(--ink-primary) truncate max-w-[100px]">
                        {stat.rawName}
                      </span>
                      <span className="text-[10px] text-(--ink-tertiary) tabular-nums">
                        ({stat.count})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <ArrowRight className="w-3.5 h-3.5 text-(--ink-tertiary) shrink-0" />
                      <select
                        value={currentMappedCatId}
                        onChange={(e) =>
                          setCategoryMapping({
                            ...categoryMapping,
                            [stat.rawName]: e.target.value,
                          })
                        }
                        className="flex-1 min-w-0 px-2 py-1 rounded-(--radius-xs) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--ink-primary) cursor-pointer"
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
                        className="px-2 py-1 rounded-(--radius-xs) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) text-[11px] font-semibold flex items-center gap-0.5 border border-(--rule-hairline) shrink-0 cursor-pointer"
                        title="新建分类"
                      >
                        <Plus className="w-3 h-3 text-(--color-income)" />
                        <span>新建</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {extractedTypeStats.length > 0 && (
            <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) divide-y divide-(--rule-hairline) shadow-xs text-xs">
              {extractedTypeStats.map((t) => {
                const currentMappedType = typeMapping[t.rawName] || t.suggestedType;
                return (
                  <div key={t.rawName} className="p-2.5 flex items-center justify-between gap-2">
                    <span className="font-semibold text-(--ink-primary)">
                      {t.rawName} <span className="text-[10px] text-(--ink-tertiary)">({t.count}笔)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-(--ink-tertiary)" />
                      <select
                        value={currentMappedType}
                        onChange={(e) =>
                          setTypeMapping({
                            ...typeMapping,
                            [t.rawName]: e.target.value as TransactionType | 'skip',
                          })
                        }
                        className="px-2 py-1 rounded-(--radius-xs) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--ink-primary) cursor-pointer"
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

          <div className="pt-2 flex items-center justify-between">
            <PaperButton variant="secondary" size="sm" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>上一步</span>
            </PaperButton>
            <PaperButton variant="ink" size="sm" onClick={() => setCurrentStep(4)}>
              <span>下一步：确认导入</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-3.5 space-y-3 text-xs shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-(--ink-primary) block">默认入账账户</span>
                <span className="text-[10px] text-(--ink-tertiary)">未指定账户时归属此项</span>
              </div>
              <select
                value={defaultAccountId}
                onChange={(e) => setDefaultAccountId(e.target.value)}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--ink-primary) cursor-pointer max-w-[160px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2.5 border-t border-(--rule-hairline)">
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

          <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) divide-y divide-(--rule-hairline) shadow-xs overflow-hidden">
            <div className="px-3.5 py-2 text-[11px] font-semibold text-(--ink-tertiary) bg-(--paper-sunken)">
              数据预览 (前 {previewData.length} 笔)
            </div>
            {previewData.map((rec, i) => {
              const cat = categories.find((c) => c.id === rec.categoryId);
              const acct = accounts.find((a) => a.id === rec.accountId);
              const Icon = getCategoryIcon(cat?.icon || 'shopping-cart');

              return (
                <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary) flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 stroke-[1.8]" />
                    </div>
                    <div>
                      <div className="font-semibold text-(--ink-primary)">{cat?.name || '默认'}</div>
                      <div className="text-[10px] font-mono text-(--ink-tertiary)">
                        {rec.date} · {rec.rawAccountName || acct?.name || '默认'}
                        {rec.note && ` · ${rec.note}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'font-bold text-sm font-mono tabular-nums',
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

          <div className="pt-2 flex items-center justify-between">
            <PaperButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(3)}
              disabled={isImporting}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
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
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>导入中...</span>
                </>
              ) : (
                <>
                  <FolderSync className="w-3.5 h-3.5 mr-1" />
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
