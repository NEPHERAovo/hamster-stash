export interface LoanFlowOption {
  id: string;
  label: string;
  icon: string;
  direction: 'lend' | 'borrow';
  role: 'origin' | 'repayment';
  isInflow: boolean;
}

export const LOAN_FLOW_OPTIONS: LoanFlowOption[] = [
  {
    id: 'cat_lend_out',
    label: '借给他人',
    icon: 'arrow-up-right',
    direction: 'lend',
    role: 'origin',
    isInflow: false,
  },
  {
    id: 'cat_borrow_in',
    label: '向人借款',
    icon: 'arrow-down-left',
    direction: 'borrow',
    role: 'origin',
    isInflow: true,
  },
  {
    id: 'cat_loan_repay',
    label: '收回还款',
    icon: 'check-circle-2',
    direction: 'lend',
    role: 'repayment',
    isInflow: true,
  },
  {
    id: 'cat_debt_clear',
    label: '偿还欠款',
    icon: 'corner-down-right',
    direction: 'borrow',
    role: 'repayment',
    isInflow: false,
  },
];
