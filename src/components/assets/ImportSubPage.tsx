import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileUp,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Sliders,
  Sparkles,
  Info,
  Scale,
  RefreshCw,
  FolderSync,
  MessageCircle,
  Zap,
  WalletCards,
  Fish,
  NotebookPen,
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
import { cn } from '../../utils/cn';
import type { TransactionType } from '../../types/transaction';

export interface ImportSubPageProps {
  onClose: () => void;
  onImportSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

const PRESET_ICONS: Record<string, React.FC<{ className?: string }>> = {
  sparkles: Sparkles,
  'message-circle': MessageCircle,
  zap: Zap,
  'wallet-cards': WalletCards,
  fish: Fish,
  'notebook-pen': NotebookPen,
  sliders: Sliders,
};

export const ImportSubPage: React.FC<ImportSubPageProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { accounts, createAccount, loadAccounts } = useAccountStore();
  const { categories, createCategory, loadCategories } = useCategoryStore();
  const { importTransactions } = useLedgerStore();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('elephant');
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCsvResult>({ headers: [], rows: [] });

  const [mapping, setMapping] = useState<CsvColumnMapping>({});

  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({}); // rawCatName -> categoryId
  const [typeMapping, setTypeMapping] = useState<Record<string, TransactionType | 'skip'>>({}); // rawTypeName -> targetType
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
        throw new Error('CSV 文件内容为空或未能识别到有效表格数据');
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
      setErrorMsg('读取文件失败：' + (err instanceof Error ? err.message : '未知原因'));
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

      toast.success(`已新建分类「${rawName}」并完成映射`);
    } catch (err) {
      toast.error('创建分类失败：' + (err instanceof Error ? err.message : '未知原因'));
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
        toast.success(`成功一键新建 ${createdCount} 个分类并绑定！`);
      } else {
        toast.info('所有类别均已在系统中存在或已完成映射');
      }
    } catch (err) {
      toast.error('批量新建分类失败：' + (err instanceof Error ? err.message : '未知原因'));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const previewData = useMemo<PreparedImportRecord[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0 || !defaultAccountId) {
      return [];
    }
    const sampleRows = parsed.rows.slice(0, 5);
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
      setErrorMsg('没有可导入的数据行');
      return;
    }

    if (!mapping.dateCol || !mapping.amountCol) {
      setErrorMsg('请至少映射「日期」和「金额」两列');
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
        throw new Error('未解析出有效交易记录，请检查金额格式与列映射');
      }

      const res = await importTransactions(records, true);

      toast.success(
        `导入成功！共导入 ${res.importedCount} 笔账单` +
          (skippedCount > 0 ? `（忽略/跳过 ${skippedCount} 笔）` : '')
      );

      await loadCategories();
      onImportSuccess?.();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const getColOptions = () => [
    { label: '（未指定 / 使用系统默认）', value: '' },
    ...parsed.headers.map((h) => ({ label: h, value: h })),
  ];

  return (
    <div className="w-full page-slide-in pb-12 pt-1 text-(--ink-primary)">
      <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) p-3 shadow-(--shadow-xs) mb-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[2px] bg-(--border-hairline) z-0" />
          {[
            { num: 1, label: '选择来源' },
            { num: 2, label: '列映射' },
            { num: 3, label: '类型与分类' },
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
                      ? 'bg-(--color-income) text-white shadow-xs'
                      : isCur
                      ? 'bg-(--ink-primary) text-(--bg-surface) shadow-xs ring-2 ring-(--border-strong)'
                      : 'bg-(--bg-sunken) text-(--ink-tertiary) border border-(--border-hairline)'
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.num}
                </div>
                <span
                  className={cn(
                    'text-[0.6875rem] font-semibold whitespace-nowrap',
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
        <div className="p-3 mb-4 rounded-(--radius-sm) bg-(--color-expense-bg) text-(--color-expense) text-xs flex items-center gap-2 border border-[rgba(189,88,64,0.2)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="section-head">
            <span>1. 选择要导入的数据格式 / 软件</span>
            <span className="text-[0.6875rem] text-(--ink-tertiary) font-normal">支持多款记账应用</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {IMPORT_PRESETS.map((preset) => {
              const IconComp = PRESET_ICONS[preset.iconName] || Sliders;
              const isSelected = selectedPresetId === preset.id;
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
                    'p-3 rounded-(--radius-md) border transition-all cursor-pointer flex flex-col justify-between relative',
                    isSelected
                      ? 'bg-(--bg-surface) border-(--ink-primary) shadow-(--shadow-sm) ring-1 ring-(--ink-primary)'
                      : 'bg-(--bg-surface) border-(--border-hairline) hover:border-(--border-default)'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-(--radius-sm) flex items-center justify-center',
                          isSelected
                            ? 'bg-(--color-accent-bg) text-(--color-accent)'
                            : 'bg-(--bg-sunken) text-(--ink-secondary)'
                        )}
                      >
                        <IconComp className="w-4 h-4 stroke-[1.85]" />
                      </div>
                      {preset.badge && (
                        <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-(--bg-sunken) text-(--ink-tertiary) font-semibold">
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-(--ink-primary)">{preset.name}</div>
                    <div className="text-[0.625rem] text-(--ink-tertiary) line-clamp-2 mt-0.5">
                      {preset.shortDesc}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-(--color-income)" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-(--bg-sunken) border border-(--border-hairline) rounded-(--radius-sm) p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-(--ink-primary)">
              <Info className="w-3.5 h-3.5 text-(--color-accent)" />
              <span>{activePreset.name} 导出格式说明</span>
            </div>
            <p className="text-[0.6875rem] text-(--ink-secondary) leading-relaxed">
              {activePreset.description}
            </p>
            {activePreset.tips && (
              <ul className="text-[0.625rem] text-(--ink-tertiary) list-disc list-inside space-y-0.5 pt-1 border-t border-(--border-hairline)">
                {activePreset.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="section-head">
            <span>2. 选择导出的 CSV 账单文件</span>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-(--radius-md) p-6 text-center cursor-pointer transition-all',
              fileName
                ? 'bg-(--bg-surface) border-(--border-default)'
                : 'bg-(--bg-surface) border-(--border-hairline) hover:border-(--border-strong) hover:bg-(--bg-hover)'
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
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-(--color-income-bg) text-(--color-income) flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="font-bold text-xs text-(--ink-primary)">{fileName}</div>
                  <div className="text-[0.6875rem] text-(--ink-tertiary) mt-0.5">
                    文件大小 {fileSizeStr} · 已解析出 {parsed.rows.length} 行数据
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-[0.6875rem] text-(--color-accent) underline cursor-pointer"
                >
                  更换其他文件
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-(--bg-sunken) text-(--ink-secondary) flex items-center justify-center mx-auto">
                  <FileUp className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-(--ink-primary)">
                    点击选择本地 CSV 文件
                  </div>
                  <div className="text-[0.6875rem] text-(--ink-tertiary) mt-0.5">
                    支持 UTF-8、GBK 编码，自动处理双引号转义与表头嗅探
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <PaperButton variant="secondary" size="sm" onClick={onClose}>
              取消
            </PaperButton>
            <PaperButton
              variant="ink"
              size="sm"
              disabled={parsed.rows.length === 0}
              onClick={() => setCurrentStep(2)}
            >
              <span>下一步：字段列映射</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="section-head">
            <span>字段列名对应设置</span>
            <span className="text-[0.6875rem] text-(--ink-tertiary) font-normal">
              已结合【{activePreset.name}】自动推测
            </span>
          </div>

          <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) p-3.5 space-y-3 text-xs shadow-(--shadow-xs)">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-(--ink-primary) flex items-center gap-1">
                  <span className="text-(--color-expense)">*</span>日期 / 时间列
                </span>
                <span className="text-[0.625rem] text-(--ink-tertiary)">流水发生时间</span>
              </div>
              <select
                value={mapping.dateCol || ''}
                onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary) flex items-center gap-1">
                  <span className="text-(--color-expense)">*</span>金额列
                </span>
                <span className="text-[0.625rem] text-(--ink-tertiary)">流水金额</span>
              </div>
              <select
                value={mapping.amountCol || ''}
                onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary)">收支类型列</span>
                <span className="text-[0.625rem] text-(--ink-tertiary) block">如支出/收入/不计收支</span>
              </div>
              <select
                value={mapping.typeCol || ''}
                onChange={(e) => setMapping({ ...mapping, typeCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary) flex items-center gap-1">
                  <span className="text-(--color-income)">*</span>分类名称列
                </span>
                <span className="text-[0.625rem] text-(--ink-tertiary) block">下一步将统计所有分类并映射</span>
              </div>
              <select
                value={mapping.categoryCol || ''}
                onChange={(e) => setMapping({ ...mapping, categoryCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary)">资金账户 / 渠道列</span>
                <span className="text-[0.625rem] text-(--ink-tertiary) block">如微信钱包、招商银行卡</span>
              </div>
              <select
                value={mapping.accountCol || ''}
                onChange={(e) => setMapping({ ...mapping, accountCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary)">备注 / 商品说明列</span>
                <span className="text-[0.625rem] text-(--ink-tertiary) block">交易商户或描述</span>
              </div>
              <select
                value={mapping.noteCol || ''}
                onChange={(e) => setMapping({ ...mapping, noteCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-(--border-hairline) pt-2.5">
              <div>
                <span className="font-semibold text-(--ink-primary)">是否报销列</span>
                <span className="text-[0.625rem] text-(--ink-tertiary) block">仅部分记账应用包含</span>
              </div>
              <select
                value={mapping.reimburseCol || ''}
                onChange={(e) => setMapping({ ...mapping, reimburseCol: e.target.value || undefined })}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {getColOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {parsed.rows.length > 0 && mapping.dateCol && mapping.amountCol && (
            <div className="space-y-1.5">
              <span className="text-[0.6875rem] font-semibold text-(--ink-tertiary) block">
                列映射数据抽样检查 (前 2 条)
              </span>
              <div className="bg-(--bg-sunken) border border-(--border-hairline) rounded-(--radius-sm) divide-y divide-(--border-hairline) text-[0.6875rem] p-1">
                {parsed.rows.slice(0, 2).map((row, idx) => {
                  const dateVal = mapping.dateCol ? row[parsed.headers.indexOf(mapping.dateCol)] : '';
                  const amtVal = mapping.amountCol ? row[parsed.headers.indexOf(mapping.amountCol)] : '';
                  const catVal = mapping.categoryCol ? row[parsed.headers.indexOf(mapping.categoryCol)] : '默认';
                  const noteVal = mapping.noteCol ? row[parsed.headers.indexOf(mapping.noteCol)] : '';
                  return (
                    <div key={idx} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-(--ink-tertiary)">{dateVal}</span>
                        <span className="font-semibold text-(--ink-primary)">{catVal}</span>
                        {noteVal && <span className="text-(--ink-secondary) truncate max-w-[120px]">{noteVal}</span>}
                      </div>
                      <span className="font-bold tabular-nums text-(--ink-primary)">¥ {amtVal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  setErrorMsg('请至少映射「日期」和「金额」两列');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(3);
              }}
            >
              <span>下一步：账单类型与分类映射</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="section-head flex items-center justify-between">
            <span>账单分类与类型映射</span>
            <span className="text-[0.6875rem] text-(--ink-tertiary) font-normal">
              统计出 {extractedCategoryStats.length} 个分类
            </span>
          </div>

          <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) p-3 shadow-(--shadow-xs) space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-(--ink-primary) block">
                  自动统计出 CSV 中的所有账单分类
                </span>
                <span className="text-[0.625rem] text-(--ink-tertiary)">
                  系统已按同名与别名推荐匹配，您可手动调整，或一键将新分类建入系统
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-(--border-hairline)">
              <button
                type="button"
                onClick={handleBatchCreateMissingCategories}
                disabled={isCreatingCategory}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--color-accent-bg) text-(--color-accent) text-[0.6875rem] font-bold flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>一键将所有未匹配分类新增到系统</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[0.6875rem] font-semibold text-(--ink-secondary) block">
              分类对照表 ({extractedCategoryStats.length} 项)
            </span>

            {extractedCategoryStats.length === 0 ? (
              <div className="text-center py-6 bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) text-xs text-(--ink-tertiary)">
                未在 CSV 中指定分类列或分类列中无有效数据，导入将统一使用默认收支分类。
              </div>
            ) : (
              <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) divide-y divide-(--border-hairline) shadow-(--shadow-xs) overflow-hidden">
                {extractedCategoryStats.map((stat) => {
                  const currentMappedCatId = categoryMapping[stat.rawName] || stat.suggestedCategoryId || (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
                  const isExactExistInSystem = categories.some((c) => c.name.trim().toLowerCase() === stat.rawName.trim().toLowerCase());

                  return (
                    <div key={stat.rawName} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-[90px] shrink-0">
                        <span className="font-bold text-(--ink-primary) truncate max-w-[110px]">
                          {stat.rawName}
                        </span>
                        <span className={cn(
                          'text-[0.625rem] px-1.5 py-0.2 rounded-full font-semibold tabular-nums',
                          stat.dominantType === 'income'
                            ? 'bg-(--color-income-bg) text-(--color-income)'
                            : 'bg-(--bg-sunken) text-(--ink-tertiary)'
                        )}>
                          {stat.count}笔
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <ArrowRight className="w-3.5 h-3.5 text-(--ink-tertiary) shrink-0" />
                        <select
                          value={currentMappedCatId}
                          onChange={(e) => {
                            setCategoryMapping({
                              ...categoryMapping,
                              [stat.rawName]: e.target.value,
                            });
                          }}
                          className="flex-1 min-w-0 px-2 py-1 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer"
                        >
                          <optgroup label="支出分类">
                            {categories.filter((c) => c.type === 'expense').map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="收入分类">
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
                          className="px-2 py-1 rounded-(--radius-xs) bg-(--bg-sunken) hover:bg-(--bg-hover) text-(--ink-primary) text-[0.625rem] font-semibold flex items-center gap-1 shrink-0 border border-(--border-hairline) cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-(--color-income)" />
                          <span>新增分类</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {extractedTypeStats.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[0.6875rem] font-semibold text-(--ink-secondary) block">
                收支性质类型映射 ({extractedTypeStats.length} 项)
              </span>

              <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) divide-y divide-(--border-hairline) shadow-(--shadow-xs) text-xs">
                {extractedTypeStats.map((t) => {
                  const currentMappedType = typeMapping[t.rawName] || t.suggestedType;
                  return (
                    <div key={t.rawName} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-(--ink-primary)">{t.rawName}</span>
                        <span className="text-[0.625rem] text-(--ink-tertiary) tabular-nums">
                          ({t.count} 笔)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-(--ink-tertiary)" />
                        <select
                          value={currentMappedType}
                          onChange={(e) => {
                            setTypeMapping({
                              ...typeMapping,
                              [t.rawName]: e.target.value as TransactionType | 'skip',
                            });
                          }}
                          className="px-2.5 py-1 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer"
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
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <PaperButton variant="secondary" size="sm" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>上一步</span>
            </PaperButton>
            <PaperButton
              variant="ink"
              size="sm"
              onClick={() => setCurrentStep(4)}
            >
              <span>下一步：确认与导入</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </PaperButton>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="section-head">
            <span>账户归属与选项配置</span>
          </div>

          <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) p-3.5 space-y-3 text-xs shadow-(--shadow-xs)">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-(--ink-primary) block">默认归属账户</span>
                <span className="text-[0.625rem] text-(--ink-tertiary)">
                  当 CSV 未指定账户列或账户名称未匹配时归属此项
                </span>
              </div>
              <select
                value={defaultAccountId}
                onChange={(e) => setDefaultAccountId(e.target.value)}
                className="px-2.5 py-1.5 rounded-(--radius-xs) bg-(--bg-sunken) border border-(--border-hairline) text-(--ink-primary) text-xs outline-none focus:border-(--border-strong) cursor-pointer max-w-[160px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-2 cursor-pointer pt-2.5 border-t border-(--border-hairline)">
              <input
                type="checkbox"
                checked={autoCreateAccounts}
                onChange={(e) => setAutoCreateAccounts(e.target.checked)}
                className="mt-0.5 rounded text-(--ink-primary)"
              />
              <div>
                <span className="font-semibold text-(--ink-primary) block">
                  自动创建 CSV 中出现的未登记账户
                </span>
                <span className="text-[0.625rem] text-(--ink-tertiary) leading-tight block">
                  如微信零钱、银行卡、信用卡账户将自动独立归集，避免挤占单一口径账户。
                </span>
              </div>
            </label>
          </div>

          <div className="p-3 rounded-(--radius-sm) bg-(--bg-sunken) border border-(--border-hairline) text-[0.6875rem] text-(--ink-secondary) flex items-start gap-2">
            <Scale className="w-4 h-4 text-(--color-accent) shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-(--ink-primary) block">资产结余与对账提醒</span>
              所有流水将按时间轴入库并参与结余统计。若导入的是历史局部明细，导入完成后可在「资产」页面进入各账户，使用「平账校准」一键将余额校对为您手头的真实盘点额度。
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[0.6875rem] font-semibold text-(--ink-tertiary) block uppercase tracking-wider">
              最终解析样例卡片预览 (前 {previewData.length} 条)
            </span>

            <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) divide-y divide-(--border-hairline) shadow-(--shadow-xs) overflow-hidden">
              {previewData.map((rec, i) => {
                const cat = categories.find((c) => c.id === rec.categoryId);
                const acct = accounts.find((a) => a.id === rec.accountId);
                const Icon = getCategoryIcon(cat?.icon || 'shopping-cart');

                return (
                  <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-(--radius-xs) bg-(--bg-sunken) text-(--ink-secondary) flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-(--ink-primary)">{cat?.name || '未知分类'}</span>
                          {rec.isReimbursable && (
                            <span className="text-[0.625rem] px-1 rounded bg-(--color-accent-bg) text-(--color-accent)">待报销</span>
                          )}
                        </div>
                        <div className="text-[0.625rem] text-(--ink-tertiary) flex items-center gap-1">
                          <span>{rec.date}</span>
                          <span>·</span>
                          <span>{rec.rawAccountName || acct?.name || '默认账户'}</span>
                          {rec.note && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{rec.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        'font-bold text-sm tabular-nums',
                        rec.type === 'income' ? 'text-(--color-income)' : 'text-(--color-expense)'
                      )}>
                        {rec.type === 'income' ? '+' : '-'} ¥{centsToYuan(rec.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  <span>正在批量入库...</span>
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
