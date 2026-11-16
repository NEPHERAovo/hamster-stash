export type TransactionType = 'income' | 'expense' | 'transfer' | 'reconcile' | 'loan';
export type LoanRole = 'origin' | 'repayment'; // origin=初始借款, repayment=归还/回款
export type LoanStatus = 'pending' | 'partially_repaid' | 'settled';
export type ReimburseStatus = 'pending' | 'settled';

export interface VoucherAttachment {
  name: string;               // 凭证文件名，如 "发票凭证.pdf"
  size: string;               // 文件大小，如 "326 KB"
  title?: string;             // 抬头/票据类型
  itemName?: string;          // 消费品名/行程事由
  fileUrl?: string;           // Base64 或本地 Blob URL
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;             // 金额（单位：分，非负整数，1元=100分）
  categoryId: string;         // 关联分类 ID
  accountId: string;          // 关联账户 ID
  toAccountId?: string;       // 转账目标账户 ID (转账类型适用)
  reconcileDiff?: number;     // 平账差额（单位：分，可正可负，平账类型适用）

  loanParty?: string;         // 往来对方姓名 (例如 "张三")
  loanDirection?: 'lend' | 'borrow'; // lend=借出他人, borrow=向人借款
  loanRole?: LoanRole;        // 角色：初始借贷或还款流水
  relatedLoanId?: string;     // 关联的原始借贷交易 ID
  loanStatus?: LoanStatus;    // 借贷状态 (仅 origin 记录维护)
  repaidAmount?: number;      // 已还/已收金额（单位：分）

  isReimbursable?: boolean;   // 是否为待报销垫付
  reimburseTarget?: string;   // 报销对象（如 "公司财务报销"）
  reimburseStatus?: ReimburseStatus; // 报销状态 (pending | settled)

  offsetTransactionId?: string;

  voucher?: VoucherAttachment;

  ext?: Record<string, unknown>;

  date: string;               // ISO 格式 'YYYY-MM-DD'
  note?: string;              // 备注
  tags?: string[];            // 标签列表
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}
