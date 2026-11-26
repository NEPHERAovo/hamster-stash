import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckIcon as Check, WarningCircleIcon as AlertCircle } from '@phosphor-icons/react';
import { parseTabularFile, type ParsedCsvResult } from '../../domain/import-export/csvParser';
import {
  inferColumnMapping,
  mapConfiguredCsvRows,
  extractCategoriesFromCsv,
  extractTransactionTypesFromCsv,
  summarizePreFilterCounts,
  type CsvColumnMapping,
  type ExtractedCategoryStat,
  type ExtractedTypeStat,
  type ConfiguredMappingResult,
  type PreFilterSummary,
} from '../../domain/import-export/csvMapper';
import {
  detectBillSource,
  extractExistingImportKeys,
  preprocessBillTable,
  type BillSource,
} from '../../domain/import-export/billNormalizer';
import { IMPORT_PRESETS, type ImportPreset } from '../../domain/import-export/importPresets';
import { ImportService } from '../../domain/import-export/importService';
import { useAccountStore } from '../../stores/useAccountStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { toast } from '../../stores/useToastStore';
import { useSubPage } from '../layout/SubPageContext';
import { cn } from '../../utils/cn';
import type { TransactionType } from '../../types/transaction';
import { ImportStep1Upload } from './import/ImportStep1Upload';
import { ImportStep2Columns } from './import/ImportStep2Columns';
import { ImportStep3CategoryMatch } from './import/ImportStep3CategoryMatch';
import { ImportStep4Preview } from './import/ImportStep4Preview';

export interface ImportSubPageProps {
  onClose?: () => void;
  onImportSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

function buildMergedMapping(
  headers: string[],
  presetDefaultMapping: CsvColumnMapping
): CsvColumnMapping {
  const inferred = inferColumnMapping(headers);
  const pick = (presetCol?: string, inferredCol?: string) =>
    presetCol && headers.includes(presetCol) ? presetCol : inferredCol;

  return {
    dateCol: pick(presetDefaultMapping.dateCol, inferred.dateCol),
    amountCol: pick(presetDefaultMapping.amountCol, inferred.amountCol),
    typeCol: pick(presetDefaultMapping.typeCol, inferred.typeCol),
    categoryCol: pick(presetDefaultMapping.categoryCol, inferred.categoryCol),
    accountCol: pick(presetDefaultMapping.accountCol, inferred.accountCol),
    noteCol: pick(presetDefaultMapping.noteCol, inferred.noteCol),
    reimburseCol: pick(presetDefaultMapping.reimburseCol, inferred.reimburseCol),
    statusCol: pick(presetDefaultMapping.statusCol, inferred.statusCol),
    orderIdCol: pick(presetDefaultMapping.orderIdCol, inferred.orderIdCol),
  };
}

function alignRowsToHeaders(
  targetHeaders: string[],
  sourceHeaders: string[],
  sourceRows: string[][]
): string[][] {
  const sameOrder =
    targetHeaders.length === sourceHeaders.length &&
    targetHeaders.every((h, idx) => h === sourceHeaders[idx]);
  if (sameOrder) return sourceRows;

  const colIndexMap = targetHeaders.map((h) => sourceHeaders.indexOf(h));
  return sourceRows.map((row) =>
    colIndexMap.map((srcIdx) => (srcIdx >= 0 ? row[srcIdx] ?? '' : ''))
  );
}

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
  const { transactions, importTransactions } = useLedgerStore();
  const isReimbursementEnabled = usePreferenceStore((s) => s.isReimbursementEnabled);

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('wechat');
  const [detectedSource, setDetectedSource] = useState<BillSource | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileCount, setFileCount] = useState<number>(0);
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCsvResult>({ headers: [], rows: [] });

  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [typeMapping, setTypeMapping] = useState<Record<string, TransactionType | 'skip'>>({});
  const [skipClosedAndFullRefunds, setSkipClosedAndFullRefunds] = useState<boolean>(true);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [aggregateWealthEarningsMonthly, setAggregateWealthEarningsMonthly] =
    useState<boolean>(true);
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);

  const [defaultAccountId, setDefaultAccountId] = useState<string>('');
  const [autoCreateAccounts, setAutoCreateAccounts] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const activePreset = useMemo<ImportPreset>(() => {
    return IMPORT_PRESETS.find((p) => p.id === selectedPresetId) || IMPORT_PRESETS[0];
  }, [selectedPresetId]);

  const activeSource = selectedPresetId as BillSource;

  const existingImportKeys = useMemo(
    () => extractExistingImportKeys(transactions ?? []),
    [transactions]
  );

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
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      setErrorMsg('');
      const parsedResults = await Promise.all(files.map((file) => parseTabularFile(file)));

      let batchSource: BillSource | null = null;
      let mergedHeaders: string[] = [];
      const mergedRows: string[][] = [];

      for (const res of parsedResults) {
        if (res.headers.length === 0 || res.rows.length === 0) {
          throw new Error('账单文件内容为空或未能识别到表格数据');
        }
        const fileSource = detectBillSource(res.headers, res.metadataLines);
        if (batchSource === null) {
          batchSource = fileSource;
        } else if (batchSource !== fileSource) {
          throw new Error('请分批导入不同平台的账单文件');
        }

        const preprocessed = preprocessBillTable(res, fileSource);
        if (mergedHeaders.length === 0) {
          mergedHeaders = preprocessed.headers;
        }
        mergedRows.push(
          ...alignRowsToHeaders(mergedHeaders, preprocessed.headers, preprocessed.rows)
        );
      }

      const resolvedSource = batchSource ?? 'standard';
      const targetPreset =
        IMPORT_PRESETS.find((p) => p.id === resolvedSource) || IMPORT_PRESETS[0];
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      setSelectedPresetId(resolvedSource);
      setDetectedSource(resolvedSource);
      setFileCount(files.length);
      setFileName(files.length === 1 ? files[0].name : `已选 ${files.length} 个文件`);
      setFileSizeStr((totalSize / 1024).toFixed(1) + ' KB');
      setParsed({ headers: mergedHeaders, rows: mergedRows });
      setMapping(buildMergedMapping(mergedHeaders, targetPreset.defaultMapping || {}));
      setCategoryMapping({});
      setTypeMapping({});
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
      activePreset.categoryAliases || {},
      {
        amountColName: mapping.amountCol,
        statusColName: mapping.statusCol,
        noteColName: mapping.noteCol,
        source: activeSource,
        skipClosedAndFullRefunds,
        aggregateWealthEarningsMonthly,
      }
    );
  }, [
    parsed,
    mapping.categoryCol,
    mapping.typeCol,
    mapping.amountCol,
    mapping.statusCol,
    mapping.noteCol,
    categories,
    activePreset,
    activeSource,
    skipClosedAndFullRefunds,
    aggregateWealthEarningsMonthly,
  ]);

  const extractedTypeStats = useMemo<ExtractedTypeStat[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0 || !mapping.typeCol) return [];
    return extractTransactionTypesFromCsv(parsed.headers, parsed.rows, mapping.typeCol, {
      categoryColName: mapping.categoryCol,
      amountColName: mapping.amountCol,
      statusColName: mapping.statusCol,
      noteColName: mapping.noteCol,
      source: activeSource,
      skipClosedAndFullRefunds,
      aggregateWealthEarningsMonthly,
    });
  }, [
    parsed,
    mapping.typeCol,
    mapping.categoryCol,
    mapping.amountCol,
    mapping.statusCol,
    mapping.noteCol,
    activeSource,
    skipClosedAndFullRefunds,
    aggregateWealthEarningsMonthly,
  ]);

  const step3PreFilterSummary = useMemo<PreFilterSummary>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      return { filteredStatusCount: 0, invalidAmountCount: 0, wealthDailyRowCount: 0 };
    }
    return summarizePreFilterCounts(parsed.headers, parsed.rows, mapping, {
      source: activeSource,
      skipClosedAndFullRefunds,
      aggregateWealthEarningsMonthly,
    });
  }, [
    parsed,
    mapping,
    activeSource,
    skipClosedAndFullRefunds,
    aggregateWealthEarningsMonthly,
  ]);

  useEffect(() => {
    if (currentStep === 3) {
      setCategoryMapping((prev) => {
        const next = { ...prev };
        for (const stat of extractedCategoryStats) {
          if (!next[stat.rawName]) {
            next[stat.rawName] =
              stat.suggestedCategoryId ||
              (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
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
  }, [
    currentStep,
    extractedCategoryStats,
    extractedTypeStats,
    defaultExpenseCat,
    defaultIncomeCat,
  ]);

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

  const importSummary = useMemo<ConfiguredMappingResult>(() => {
    if (
      currentStep !== 4 ||
      parsed.headers.length === 0 ||
      parsed.rows.length === 0 ||
      !defaultAccountId
    ) {
      return {
        records: [],
        skippedItems: [],
        skippedCount: 0,
        duplicateCount: 0,
        filteredStatusCount: 0,
        neutralCount: 0,
        wealthRollupCount: 0,
        wealthDailyRowCount: 0,
      };
    }
    return mapConfiguredCsvRows(parsed.headers, parsed.rows, {
      mapping,
      categoryMapping,
      typeMapping,
      defaultAccountId,
      defaultExpenseCategoryId: defaultExpenseCat,
      defaultIncomeCategoryId: defaultIncomeCat,
      existingCategories: categories,
      existingAccounts: accounts,
      source: activeSource,
      skipClosedAndFullRefunds,
      skipDuplicates,
      aggregateWealthEarningsMonthly,
      existingImportKeys,
      existingTransactions: transactions,
    });
  }, [
    currentStep,
    parsed,
    mapping,
    categoryMapping,
    typeMapping,
    defaultAccountId,
    defaultExpenseCat,
    defaultIncomeCat,
    categories,
    accounts,
    activeSource,
    skipClosedAndFullRefunds,
    skipDuplicates,
    aggregateWealthEarningsMonthly,
    existingImportKeys,
    transactions,
  ]);

  const previewData = useMemo(() => {
    const records = importSummary.records;
    if (records.length <= 6) return records;
    const rollups = records.filter((r) => r.isWealthMonthlyRollup);
    if (rollups.length === 0) return records.slice(0, 6);
    const regulars = records.filter((r) => !r.isWealthMonthlyRollup);
    return [...regulars.slice(0, 5), rollups[0]];
  }, [importSummary.records]);

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
      const importService = new ImportService();
      const res = await importService.executeCsvImport({
        headers: parsed.headers,
        rows: parsed.rows,
        mapping,
        categoryMapping,
        typeMapping,
        defaultAccountId,
        defaultExpenseCategoryId: defaultExpenseCat,
        defaultIncomeCategoryId: defaultIncomeCat,
        existingCategories: categories,
        existingAccounts: accounts,
        autoCreateAccounts,
        source: activeSource,
        skipClosedAndFullRefunds,
        skipDuplicates,
        aggregateWealthEarningsMonthly,
        existingTransactions: transactions,
        createAccount,
        importTransactions,
      });

      if (res.createdAccountCount > 0) {
        await loadAccounts();
      }

      const detailParts: string[] = [];
      if (res.wealthRollupCount > 0) {
        detailParts.push(`含理财月结 ${res.wealthRollupCount} 笔`);
      }
      if (res.skippedCount > 0) {
        detailParts.push(`跳过 ${res.skippedCount} 笔`);
      }
      if (res.duplicateCount > 0) {
        detailParts.push(`含重复 ${res.duplicateCount} 笔`);
      }
      const suffix = detailParts.length > 0 ? `（${detailParts.join('，')}）` : '';
      toast.success(`成功导入 ${res.importedCount} 笔流水${suffix}`);

      if (res.reimbursableCount > 0 && !isReimbursementEnabled) {
        toast.info(
          `导入流水中含 ${res.reimbursableCount} 笔待报销账单。当前设置中已停用报销功能，可在设置中开启以查看报销状态。`
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

  return (
    <div className="w-full space-y-4 px-4 pt-1 pb-12 text-(--ink-primary)">
      <div className="rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3 shadow-xs">
        <div className="relative flex items-center justify-between px-2">
          <div className="absolute inset-x-6 top-3 z-0 h-px -translate-y-1/2 bg-(--rule-hairline)" />
          {[
            { num: 1, label: '上传文件' },
            { num: 2, label: '字段列' },
            { num: 3, label: '分类匹配' },
            { num: 4, label: '确认导入' },
          ].map((s) => {
            const isDone = currentStep > s.num;
            const isCur = currentStep === s.num;
            let stepBadgeClass =
              'bg-(--paper-sunken) text-(--ink-tertiary) border border-(--rule-hairline)';
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
        <ImportStep1Upload
          selectedPresetId={selectedPresetId}
          detectedSource={detectedSource}
          onSelectPreset={(presetId) => {
            setSelectedPresetId(presetId);
            if (parsed.headers.length > 0) {
              const targetPreset = IMPORT_PRESETS.find((p) => p.id === presetId);
              setMapping(buildMergedMapping(parsed.headers, targetPreset?.defaultMapping || {}));
            }
          }}
          rowCount={parsed.rows.length}
          fileName={fileName}
          fileCount={fileCount}
          fileSizeStr={fileSizeStr}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onCancel={handleClose}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && (
        <ImportStep2Columns
          headers={parsed.headers}
          mapping={mapping}
          onChangeMapping={setMapping}
          isReimbursementEnabled={isReimbursementEnabled}
          detectedSource={activeSource}
          skipClosedAndFullRefunds={skipClosedAndFullRefunds}
          onChangeSkipClosedAndFullRefunds={setSkipClosedAndFullRefunds}
          skipDuplicates={skipDuplicates}
          onChangeSkipDuplicates={setSkipDuplicates}
          aggregateWealthEarningsMonthly={aggregateWealthEarningsMonthly}
          onChangeAggregateWealthEarningsMonthly={setAggregateWealthEarningsMonthly}
          onPrev={() => setCurrentStep(1)}
          onNext={() => {
            if (!mapping.dateCol || !mapping.amountCol) {
              setErrorMsg('请至少指定「日期」和「金额」列');
              return;
            }
            setErrorMsg('');
            setCurrentStep(3);
          }}
        />
      )}

      {currentStep === 3 && (
        <ImportStep3CategoryMatch
          categories={categories}
          extractedCategoryStats={extractedCategoryStats}
          extractedTypeStats={extractedTypeStats}
          preFilterSummary={step3PreFilterSummary}
          categoryMapping={categoryMapping}
          typeMapping={typeMapping}
          defaultExpenseCat={defaultExpenseCat}
          defaultIncomeCat={defaultIncomeCat}
          isCreatingCategory={isCreatingCategory}
          onChangeCategoryMapping={setCategoryMapping}
          onChangeTypeMapping={setTypeMapping}
          onCreateCategoryForRaw={handleCreateCategoryForRaw}
          onBatchCreateMissingCategories={handleBatchCreateMissingCategories}
          onPrev={() => setCurrentStep(2)}
          onNext={() => setCurrentStep(4)}
        />
      )}

      {currentStep === 4 && (
        <ImportStep4Preview
          accounts={accounts}
          categories={categories}
          defaultAccountId={defaultAccountId}
          onChangeDefaultAccountId={setDefaultAccountId}
          autoCreateAccounts={autoCreateAccounts}
          onChangeAutoCreateAccounts={setAutoCreateAccounts}
          isReimbursementEnabled={isReimbursementEnabled}
          previewData={previewData}
          totalRowsCount={parsed.rows.length}
          effectiveCount={importSummary.records.length}
          skippedCount={importSummary.skippedCount}
          duplicateCount={importSummary.duplicateCount}
          filteredStatusCount={importSummary.filteredStatusCount}
          neutralCount={importSummary.neutralCount}
          wealthRollupCount={importSummary.wealthRollupCount}
          wealthDailyRowCount={importSummary.wealthDailyRowCount}
          skippedItems={importSummary.skippedItems}
          isImporting={isImporting}
          onPrev={() => setCurrentStep(3)}
          onConfirmImport={handleStartImport}
        />
      )}
    </div>
  );
};

export default ImportSubPage;
