export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit' | 'investment' | 'other';

export interface Account {
  id: string;
  name: string;               // 账户名称，如 "微信零钱"、"招商银行卡"
  type: AccountType;          // 账户类型
  balance: number;            // 当前余额（单位：分，信用卡可为负）
  currency: string;           // 默认 'CNY'
  icon: string;               // Lucide 图标名称，如 'wallet' | 'landmark' | 'credit-card'
  color?: string;             // 主题色彩标记
  sortOrder: number;
  includeInNetWorth?: boolean;
  isArchived?: boolean;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}
