import { useLedgerStore } from '../../stores/useLedgerStore';
import type { CreateTransactionInput } from '../../domain/transaction/transactionService';

export function useHostTransactionActions() {
  const recordTransaction = useLedgerStore((s) => s.recordTransaction);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const deleteTransaction = useLedgerStore((s) => s.deleteTransaction);

  return {
    recordTransaction: (input: CreateTransactionInput) => recordTransaction(input),
    updateTransaction: (id: string, input: Partial<CreateTransactionInput>) => updateTransaction(id, input),
    deleteTransaction: (id: string) => deleteTransaction(id),
  };
}
