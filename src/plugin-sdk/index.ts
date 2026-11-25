export { BasePlugin } from '../core/plugin/types';
export type {
  PluginManifest,
  PluginContext,
  PluginCollection,
  MiddlewareContext,
  MiddlewareHandler,
  NavTabDescriptor,
} from '../core/plugin/types';

export type {
  Transaction,
  TransactionType,
  LoanRole,
  LoanStatus,
  ReimburseStatus,
  VoucherAttachment,
} from './types/common';
export type { CreateTransactionInput } from '../domain/transaction/transactionService';
export type { Account, AccountType } from './types/common';
export type { Category, CategoryType } from './types/common';

export {
  useHostTransactions,
  getHostTransactions,
  useHostAccounts,
  useHostCategories,
  getHostCategories,
  useHostCurrentMonth,
} from './hooks/useHostData';
export { useHostTransactionActions } from './hooks/useHostTransactionActions';
export { usePluginNavigation } from './hooks/usePluginNavigation';
export { useSubPage } from '../components/layout/SubPageContext';

export { PluginSlot, type PluginSlotProps } from './components/PluginSlot';
export { PluginOverride, type PluginOverrideProps } from './components/PluginOverride';
export { PluginSubPageOutlet } from './components/PluginSubPageOutlet';
export { PluginModalOutlet } from './components/PluginModalOutlet';

export { PaperCard, type PaperCardProps } from '../components/ui/PaperCard';
export { PaperButton, type PaperButtonProps } from '../components/ui/PaperButton';
export { PaperIconButton, type PaperIconButtonProps } from '../components/ui/PaperIconButton';
export { PaperInput, type PaperInputProps } from '../components/ui/PaperInput';
export { AmountInput, type AmountInputProps } from '../components/ui/AmountInput';
export { PaperSelect, type PaperSelectProps, type PaperSelectOption } from '../components/ui/PaperSelect';
export { PaperChip, type PaperChipProps } from '../components/ui/PaperChip';
export { PaperModal, type PaperModalProps } from '../components/ui/PaperModal';
export { PaperBadge, type PaperBadgeProps } from '../components/ui/PaperBadge';
export { CategoryBadge, type CategoryBadgeProps } from '../components/ui/CategoryBadge';
export { SegToggle, type SegToggleProps, type SegToggleOption } from '../components/ui/SegToggle';
export { PaperSwitch, type PaperSwitchProps } from '../components/ui/PaperSwitch';
export { PaperKeypad, type PaperKeypadProps } from '../components/ui/PaperKeypad';
export { PaperDatePickerModal, type PaperDatePickerModalProps } from '../components/ui/PaperDatePickerModal';
export { PaperIconPickerModal, type PaperIconPickerModalProps } from '../components/ui/PaperIconPickerModal';
export { TransactionKeypad, type TransactionKeypadProps } from '../components/ledger/TransactionKeypad';

export { toast } from '../stores/useToastStore';
export { confirmAction, type ConfirmOptions } from '../stores/useConfirmStore';
export { centsToYuan, yuanToCents } from '../domain/finance/balanceCalculator';
export { getCategoryIcon } from '../utils/categoryIcons';
export { dayjs, todayDate } from '../utils/date';
export { cn } from '../utils/cn';
