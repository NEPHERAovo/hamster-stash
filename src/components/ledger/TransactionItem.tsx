import React from 'react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { PluginOverride } from '../../plugin-sdk/components/PluginOverride';
import { StandardTxRow } from './rows/StandardTxRow';
import { TransferTxRow } from './rows/TransferTxRow';
import { LoanTxRow } from './rows/LoanTxRow';
import { ReconcileTxRow } from './rows/ReconcileTxRow';

export interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  hideAccountName?: boolean;
  runningBalance?: string;
  offsetAmount?: number;
  offsetTargetNote?: string;
  onClick?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSaved?: (tx: Transaction) => void;
  onDeleted?: (id: string) => void;
}

export const TransactionItemBase: React.FC<TransactionItemProps> = (props) => {
  const { transaction, onClick, onToggleExpand } = props;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onToggleExpand) {
      onToggleExpand();
    }
  };

  switch (transaction.type) {
    case 'transfer':
      return <TransferTxRow {...props} onClick={handleClick} />;
    case 'loan':
      return <LoanTxRow {...props} onClick={handleClick} />;
    case 'reconcile':
      return <ReconcileTxRow {...props} onClick={handleClick} />;
    case 'income':
    case 'expense':
    default:
      return <StandardTxRow {...props} onClick={handleClick} />;
  }
};

export const TransactionItem: React.FC<TransactionItemProps> = (props) => {
  return (
    <PluginOverride point="tx.row.item" fallback={TransactionItemBase} props={props} />
  );
};

export default TransactionItem;
