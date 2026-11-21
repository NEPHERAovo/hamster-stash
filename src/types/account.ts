export type AccountType = 'savings' | 'credit';
export type AccountCategory = AccountType;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  icon: string;
  color?: string;
  sortOrder: number;
  includeInNetWorth?: boolean;
  isArchived?: boolean;
  creditLimit?: number;
  billDay?: number;
  repaymentDay?: number;
  repaymentAccountId?: string;
  autoRepay?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const isCreditAccount = (account: { type: AccountType }): boolean => {
  return account.type === 'credit';
};
