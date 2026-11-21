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
  useHostAccounts,
  useHostCategories,
  getHostCategories,
  useHostCurrentMonth,
} from './hooks/useHostData';
export { useHostTransactionActions } from './hooks/useHostTransactionActions';
export { usePluginNavigation } from './hooks/usePluginNavigation';

export { PluginSlot, type PluginSlotProps } from './components/PluginSlot';
export { PluginOverride, type PluginOverrideProps } from './components/PluginOverride';
export { PluginSubPageOutlet } from './components/PluginSubPageOutlet';
export { PluginModalOutlet } from './components/PluginModalOutlet';

export { PaperCard, type PaperCardProps } from '../components/ui/PaperCard';
export { PaperButton, type PaperButtonProps } from '../components/ui/PaperButton';
export { PaperInput, type PaperInputProps } from '../components/ui/PaperInput';
export { PaperModal, type PaperModalProps } from '../components/ui/PaperModal';
export { PaperBadge, type PaperBadgeProps } from '../components/ui/PaperBadge';
export { CategoryBadge, type CategoryBadgeProps } from '../components/ui/CategoryBadge';
export { SegToggle, type SegToggleProps } from '../components/ui/SegToggle';
export { PaperSwitch, type PaperSwitchProps } from '../components/ui/PaperSwitch';
export { PaperKeypad, type PaperKeypadProps } from '../components/ui/PaperKeypad';
export { DrumWheelPicker, type DrumWheelPickerProps } from '../components/ledger/DrumWheelPicker';

export { toast } from '../stores/useToastStore';
export { confirmAction, type ConfirmOptions } from '../stores/useConfirmStore';
export { centsToYuan, yuanToCents } from '../domain/finance/balanceCalculator';
export { getCategoryIcon } from '../utils/categoryIcons';
export { cn } from '../utils/cn';
