export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit' | 'investment' | 'other';
export type AccountCategory = 'savings' | 'credit';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  accountCategory?: AccountCategory;
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

export const isCreditAccount = (account: { type: AccountType; accountCategory?: AccountCategory }): boolean => {
  return account.accountCategory === 'credit' || account.type === 'credit';
};
