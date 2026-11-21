export type TransactionType = 'income' | 'expense' | 'transfer' | 'reconcile' | 'loan';
export type LoanRole = 'origin' | 'repayment';
export type LoanStatus = 'pending' | 'partially_repaid' | 'settled';
export type ReimburseStatus = 'pending' | 'settled';

export interface VoucherAttachment {
  attachmentId?: string;
  name: string;
  size: string;
  mimeType?: string;
  title?: string;
  itemName?: string;
  fileUrl?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  reconcileDiff?: number;

  loanParty?: string;
  loanDirection?: 'lend' | 'borrow';
  loanRole?: LoanRole;
  relatedLoanId?: string;
  loanStatus?: LoanStatus;
  repaidAmount?: number;

  isReimbursable?: boolean;
  reimburseTarget?: string;
  reimburseStatus?: ReimburseStatus;

  offsetTransactionId?: string;

  voucher?: VoucherAttachment;

  ext?: Record<string, unknown>;

  date: string;
  note?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
