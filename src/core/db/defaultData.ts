import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 1, isSystem: true, isArchived: false },
  { id: 'cat_market', name: '超市', type: 'expense', icon: 'basket', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 2, isSystem: true, isArchived: false },
  { id: 'cat_transit', name: '交通', type: 'expense', icon: 'train-front', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 3, isSystem: true, isArchived: false },
  { id: 'cat_shop', name: '购物', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 4, isSystem: true, isArchived: false },
  { id: 'cat_home', name: '住房', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 5, isSystem: true, isArchived: false },
  { id: 'cat_fun', name: '娱乐', type: 'expense', icon: 'clapperboard', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 6, isSystem: true, isArchived: false },
  { id: 'cat_health', name: '医疗', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 7, isSystem: true, isArchived: false },
  { id: 'cat_other', name: '其他', type: 'expense', icon: 'squares-four', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 8, isSystem: true, isArchived: false },

  { id: 'cat_pet', name: '宠物', type: 'expense', icon: 'pet', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 9, isSystem: true, isArchived: true },
  { id: 'cat_digital', name: '数码', type: 'expense', icon: 'laptop', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 10, isSystem: true, isArchived: true },
  { id: 'cat_edu', name: '学习', type: 'expense', icon: 'graduation-cap', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 11, isSystem: true, isArchived: true },
  { id: 'cat_social', name: '人情', type: 'expense', icon: 'gift', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 12, isSystem: true, isArchived: true },
  { id: 'cat_car', name: '汽车', type: 'expense', icon: 'car', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 13, isSystem: true, isArchived: true },
  { id: 'cat_travel', name: '旅行', type: 'expense', icon: 'airplane', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 14, isSystem: true, isArchived: true },
  { id: 'cat_beauty', name: '美妆', type: 'expense', icon: 'magic-wand', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 15, isSystem: true, isArchived: true },
  { id: 'cat_baby', name: '育儿', type: 'expense', icon: 'baby', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 16, isSystem: true, isArchived: true },
  { id: 'cat_sport', name: '运动', type: 'expense', icon: 'sport', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 17, isSystem: true, isArchived: true },
  { id: 'cat_clothes', name: '服饰', type: 'expense', icon: 'shirt', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 18, isSystem: true, isArchived: true },
  { id: 'cat_comm', name: '通讯', type: 'expense', icon: 'smartphone', color: 'var(--cat-comm)', colorClass: 'cat-comm', sortOrder: 19, isSystem: true, isArchived: true },
  { id: 'cat_coffee', name: '烟酒', type: 'expense', icon: 'wine', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 20, isSystem: true, isArchived: true },
  { id: 'cat_fruit', name: '水果', type: 'expense', icon: 'orange-slice', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 21, isSystem: true, isArchived: true },
  { id: 'cat_office', name: '办公', type: 'expense', icon: 'briefcase', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 22, isSystem: true, isArchived: true },
  { id: 'cat_repair', name: '维修', type: 'expense', icon: 'wrench', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 23, isSystem: true, isArchived: true },
  { id: 'cat_hotel', name: '酒店', type: 'expense', icon: 'bed', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 24, isSystem: true, isArchived: true },

  { id: 'cat_salary', name: '工资', type: 'income', icon: 'wallet', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 1, isSystem: true, isArchived: false },
  { id: 'cat_bonus', name: '奖金', type: 'income', icon: 'trophy', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 2, isSystem: true, isArchived: false },
  { id: 'cat_invest', name: '理财', type: 'income', icon: 'trending-up', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 3, isSystem: true, isArchived: false },
  { id: 'cat_parttime', name: '兼职', type: 'income', icon: 'briefcase', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 4, isSystem: true, isArchived: false },
  { id: 'cat_redpacket', name: '红包', type: 'income', icon: 'gift', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 5, isSystem: true, isArchived: false },
  { id: 'cat_resale', name: '变现', type: 'income', icon: 'package', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 6, isSystem: true, isArchived: false },
  { id: 'cat_refund', name: '退款', type: 'income', icon: 'receipt', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 7, isSystem: true, isArchived: false },
  { id: 'cat_other_in', name: '其他', type: 'income', icon: 'squares-four', color: 'var(--ink-secondary)', colorClass: 'cat-salary', sortOrder: 8, isSystem: true, isArchived: false },

  { id: 'cat_provident', name: '公积金', type: 'income', icon: 'landmark', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 9, isSystem: true, isArchived: true },
  { id: 'cat_interest', name: '利息', type: 'income', icon: 'percent', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 10, isSystem: true, isArchived: true },
  { id: 'cat_rent', name: '租金', type: 'income', icon: 'house', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 11, isSystem: true, isArchived: true },
  { id: 'cat_subsidy', name: '补贴', type: 'income', icon: 'banknote', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 12, isSystem: true, isArchived: true },

  { id: 'cat_lend_out', name: '借给他人', type: 'loan', icon: 'arrow-up-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 1, isSystem: true },
  { id: 'cat_borrow_in', name: '向人借款', type: 'loan', icon: 'arrow-down-left', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 2, isSystem: true },
  { id: 'cat_loan_repay', name: '收回还款', type: 'loan', icon: 'check-circle-2', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 3, isSystem: true },
  { id: 'cat_debt_clear', name: '偿还欠款', type: 'loan', icon: 'corner-down-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 4, isSystem: true },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  { id: 'acct_default', name: '默认账户', type: 'savings', balance: 0, currency: 'CNY', icon: 'wallet', sortOrder: 1 },
];

export function getSandboxSeedData(now: string = new Date().toISOString()): {
  sampleAccounts: Account[];
  sampleTransactions: Transaction[];
} {
  const getShiftedDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const sampleAccounts: Account[] = [
    { id: 'acct_cash', name: '日常活钱', type: 'savings', balance: 125000, currency: 'CNY', icon: 'wallet', sortOrder: 1, createdAt: now, updatedAt: now },
    { id: 'acct_bank', name: '招商银行', type: 'savings', balance: 5860000, currency: 'CNY', icon: 'landmark', sortOrder: 2, createdAt: now, updatedAt: now },
    { id: 'acct_wx', name: '微信钱包', type: 'savings', balance: 64200, currency: 'CNY', icon: 'credit-card', sortOrder: 3, createdAt: now, updatedAt: now },
    { id: 'acct_credit', name: '招商信用卡', type: 'credit', balance: -150000, creditLimit: 2000000, repaymentDay: 23, repaymentAccountId: 'acct_bank', autoRepay: true, currency: 'CNY', icon: 'credit-card', sortOrder: 4, createdAt: now, updatedAt: now },
  ];

  const sampleTransactions: Transaction[] = [
    { id: 'tx_demo_1', type: 'expense', amount: 3500, accountId: 'acct_wx', categoryId: 'cat_food', date: getShiftedDate(0), note: '老街馄饨', createdAt: `${getShiftedDate(0)}T12:30:00.000Z`, updatedAt: `${getShiftedDate(0)}T12:30:00.000Z` },
    { id: 'tx_demo_2', type: 'expense', amount: 700, accountId: 'acct_wx', categoryId: 'cat_transit', date: getShiftedDate(0), note: '地铁通勤', createdAt: `${getShiftedDate(0)}T08:45:00.000Z`, updatedAt: `${getShiftedDate(0)}T08:45:00.000Z` },
    { id: 'tx_demo_3', type: 'expense', amount: 6850, accountId: 'acct_bank', categoryId: 'cat_market', date: getShiftedDate(1), note: '超市生鲜日用品', createdAt: `${getShiftedDate(1)}T18:20:00.000Z`, updatedAt: `${getShiftedDate(1)}T18:20:00.000Z` },
    { id: 'tx_demo_4', type: 'expense', amount: 2800, accountId: 'acct_wx', categoryId: 'cat_coffee', date: getShiftedDate(3), note: '下午茶烟酒茶饮', createdAt: `${getShiftedDate(3)}T15:00:00.000Z`, updatedAt: `${getShiftedDate(3)}T15:00:00.000Z` },
    { id: 'tx_demo_5', type: 'expense', amount: 4500, accountId: 'acct_wx', categoryId: 'cat_fun', date: getShiftedDate(6), note: '周末电影票', createdAt: `${getShiftedDate(6)}T19:30:00.000Z`, updatedAt: `${getShiftedDate(6)}T19:30:00.000Z` },
    { id: 'tx_demo_6', type: 'income', amount: 1680000, accountId: 'acct_bank', categoryId: 'cat_salary', date: getShiftedDate(10), note: '本月薪酬入账', createdAt: `${getShiftedDate(10)}T10:00:00.000Z`, updatedAt: `${getShiftedDate(10)}T10:00:00.000Z` },
    { id: 'tx_demo_7', type: 'expense', amount: 320000, accountId: 'acct_bank', categoryId: 'cat_home', date: getShiftedDate(15), note: '房屋月租与物业费', createdAt: `${getShiftedDate(15)}T09:00:00.000Z`, updatedAt: `${getShiftedDate(15)}T09:00:00.000Z` },
    { id: 'tx_demo_8', type: 'expense', amount: 18600, accountId: 'acct_credit', categoryId: 'cat_shop', date: getShiftedDate(22), note: '优衣库换季衣物', createdAt: `${getShiftedDate(22)}T20:15:00.000Z`, updatedAt: `${getShiftedDate(22)}T20:15:00.000Z` },
    { id: 'tx_demo_9', type: 'expense', amount: 26000, accountId: 'acct_bank', categoryId: 'cat_car', date: getShiftedDate(28), note: '汽车加油及保养', createdAt: `${getShiftedDate(28)}T11:40:00.000Z`, updatedAt: `${getShiftedDate(28)}T11:40:00.000Z` },
    { id: 'tx_demo_10', type: 'income', amount: 1680000, accountId: 'acct_bank', categoryId: 'cat_salary', date: getShiftedDate(40), note: '上月薪酬入账', createdAt: `${getShiftedDate(40)}T10:00:00.000Z`, updatedAt: `${getShiftedDate(40)}T10:00:00.000Z` },
    { id: 'tx_demo_11', type: 'expense', amount: 320000, accountId: 'acct_bank', categoryId: 'cat_home', date: getShiftedDate(45), note: '房屋月租', createdAt: `${getShiftedDate(45)}T09:00:00.000Z`, updatedAt: `${getShiftedDate(45)}T09:00:00.000Z` },
    { id: 'tx_demo_12', type: 'expense', amount: 15400, accountId: 'acct_wx', categoryId: 'cat_health', date: getShiftedDate(48), note: '医院体检与配药', createdAt: `${getShiftedDate(48)}T14:10:00.000Z`, updatedAt: `${getShiftedDate(48)}T14:10:00.000Z` },
    { id: 'tx_demo_13', type: 'expense', amount: 38800, accountId: 'acct_credit', categoryId: 'cat_travel', date: getShiftedDate(55), note: '高铁动车往返票', createdAt: `${getShiftedDate(55)}T08:00:00.000Z`, updatedAt: `${getShiftedDate(55)}T08:00:00.000Z` },
    { id: 'tx_demo_14', type: 'expense', amount: 48000, accountId: 'acct_credit', categoryId: 'cat_hotel', date: getShiftedDate(56), note: '周末酒店住宿两晚', createdAt: `${getShiftedDate(56)}T18:00:00.000Z`, updatedAt: `${getShiftedDate(56)}T18:00:00.000Z` },
    { id: 'tx_demo_15', type: 'income', amount: 500000, accountId: 'acct_bank', categoryId: 'cat_bonus', date: getShiftedDate(70), note: '季度绩效奖金', createdAt: `${getShiftedDate(70)}T11:00:00.000Z`, updatedAt: `${getShiftedDate(70)}T11:00:00.000Z` },
    { id: 'tx_demo_16', type: 'income', amount: 1680000, accountId: 'acct_bank', categoryId: 'cat_salary', date: getShiftedDate(72), note: '前两月薪酬入账', createdAt: `${getShiftedDate(72)}T10:00:00.000Z`, updatedAt: `${getShiftedDate(72)}T10:00:00.000Z` },
    { id: 'tx_demo_17', type: 'expense', amount: 12800, accountId: 'acct_wx', categoryId: 'cat_fruit', date: getShiftedDate(74), note: '水果坚果礼盒', createdAt: `${getShiftedDate(74)}T16:30:00.000Z`, updatedAt: `${getShiftedDate(74)}T16:30:00.000Z` },
    { id: 'tx_demo_laptop', type: 'expense', amount: 1200000, accountId: 'acct_credit', categoryId: 'cat_shop', date: getShiftedDate(30), note: 'MacBook Pro 分期', ext: { amortize: { enabled: true, months: 12, startMonth: getShiftedDate(30).slice(0, 7) } }, createdAt: `${getShiftedDate(30)}T10:00:00.000Z`, updatedAt: `${getShiftedDate(30)}T10:00:00.000Z` },
    { id: 'tx_demo_gym', type: 'expense', amount: 360000, accountId: 'acct_credit', categoryId: 'cat_health', date: getShiftedDate(10), note: '健身房年卡分期', ext: { amortize: { enabled: true, months: 6, startMonth: getShiftedDate(10).slice(0, 7) } }, createdAt: `${getShiftedDate(10)}T14:00:00.000Z`, updatedAt: `${getShiftedDate(10)}T14:00:00.000Z` },
    { id: 'tx_demo_dinner', type: 'expense', amount: 68000, accountId: 'acct_wx', categoryId: 'cat_food', date: getShiftedDate(4), note: '朋友聚餐 (AA垫付)', createdAt: `${getShiftedDate(4)}T19:00:00.000Z`, updatedAt: `${getShiftedDate(4)}T19:00:00.000Z` },
    { id: 'tx_demo_dinner_reimb', type: 'income', amount: 34000, accountId: 'acct_wx', categoryId: 'cat_other_in', offsetTransactionId: 'tx_demo_dinner', date: getShiftedDate(3), note: '聚餐 AA 转账收款', createdAt: `${getShiftedDate(3)}T11:00:00.000Z`, updatedAt: `${getShiftedDate(3)}T11:00:00.000Z` },
    { id: 'tx_demo_loan', type: 'loan', loanDirection: 'lend', loanRole: 'origin', loanStatus: 'partially_repaid', amount: 100000, repaidAmount: 50000, accountId: 'acct_bank', loanParty: '小张', categoryId: 'cat_other', date: getShiftedDate(25), note: '小张周转借款', createdAt: `${getShiftedDate(25)}T10:00:00.000Z`, updatedAt: `${getShiftedDate(25)}T10:00:00.000Z` },
    { id: 'tx_demo_loan_repay', type: 'loan', loanDirection: 'lend', loanRole: 'repayment', amount: 50000, accountId: 'acct_bank', loanParty: '小张', relatedLoanId: 'tx_demo_loan', categoryId: 'cat_other_in', date: getShiftedDate(5), note: '小张偿还借款', createdAt: `${getShiftedDate(5)}T16:00:00.000Z`, updatedAt: `${getShiftedDate(5)}T16:00:00.000Z` },
    { id: 'tx_demo_init_bank', type: 'income', amount: 2000000, accountId: 'acct_bank', categoryId: 'cat_other_in', date: getShiftedDate(90), note: '初始余额', createdAt: `${getShiftedDate(90)}T09:00:00.000Z`, updatedAt: `${getShiftedDate(90)}T09:00:00.000Z` },
    { id: 'tx_demo_init_cash', type: 'income', amount: 125000, accountId: 'acct_cash', categoryId: 'cat_other_in', date: getShiftedDate(90), note: '初始余额', createdAt: `${getShiftedDate(90)}T09:00:00.000Z`, updatedAt: `${getShiftedDate(90)}T09:00:00.000Z` },
  ];

  return { sampleAccounts, sampleTransactions };
}
