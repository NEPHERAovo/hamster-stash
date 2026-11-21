import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 1, isSystem: true, isArchived: false },
  { id: 'cat_market', name: '超市', type: 'expense', icon: 'basket', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 2, isSystem: true, isArchived: false },
  { id: 'cat_transit', name: '交通', type: 'expense', icon: 'train-front', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 3, isSystem: true, isArchived: false },
  { id: 'cat_shop', name: '购物', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 4, isSystem: true, isArchived: false },
  { id: 'cat_home', name: '住房', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 5, isSystem: true, isArchived: false },
  { id: 'cat_fun', name: '娱乐', type: 'expense', icon: 'clapperboard', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 6, isSystem: true, isArchived: false },
  { id: 'cat_health', name: '医疗', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 7, isSystem: true, isArchived: false },
  { id: 'cat_other', name: '其他', type: 'expense', icon: 'subscription', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 8, isSystem: true, isArchived: false },

  { id: 'cat_pet', name: '宠物', type: 'expense', icon: 'pet', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 9, isSystem: true, isArchived: true },
  { id: 'cat_digital', name: '数码', type: 'expense', icon: 'laptop', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 10, isSystem: true, isArchived: true },
  { id: 'cat_edu', name: '学习', type: 'expense', icon: 'graduation-cap', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 11, isSystem: true, isArchived: true },
  { id: 'cat_social', name: '人情', type: 'expense', icon: 'gift', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 12, isSystem: true, isArchived: true },
  { id: 'cat_car', name: '汽车', type: 'expense', icon: 'car', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 13, isSystem: true, isArchived: true },
  { id: 'cat_travel', name: '旅行', type: 'expense', icon: 'airplane', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 14, isSystem: true, isArchived: true },
  { id: 'cat_beauty', name: '美妆', type: 'expense', icon: 'subscription', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 15, isSystem: true, isArchived: true },
  { id: 'cat_baby', name: '育儿', type: 'expense', icon: 'baby', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 16, isSystem: true, isArchived: true },
  { id: 'cat_sport', name: '运动', type: 'expense', icon: 'sport', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 17, isSystem: true, isArchived: true },
  { id: 'cat_clothes', name: '服饰', type: 'expense', icon: 'shirt', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 18, isSystem: true, isArchived: true },
  { id: 'cat_comm', name: '通讯', type: 'expense', icon: 'smartphone', color: 'var(--cat-comm)', colorClass: 'cat-comm', sortOrder: 19, isSystem: true, isArchived: true },
  { id: 'cat_coffee', name: '烟酒', type: 'expense', icon: 'coffee', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 20, isSystem: true, isArchived: true },
  { id: 'cat_fruit', name: '水果', type: 'expense', icon: 'basket', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 21, isSystem: true, isArchived: true },
  { id: 'cat_office', name: '办公', type: 'expense', icon: 'briefcase', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 22, isSystem: true, isArchived: true },
  { id: 'cat_lottery', name: '彩票', type: 'expense', icon: 'ticket', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 23, isSystem: true, isArchived: true },
  { id: 'cat_repair', name: '维修', type: 'expense', icon: 'wrench', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 24, isSystem: true, isArchived: true },
  { id: 'cat_donate', name: '公益', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 25, isSystem: true, isArchived: true },
  { id: 'cat_hotel', name: '酒店', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 26, isSystem: true, isArchived: true },

  { id: 'cat_salary', name: '工资', type: 'income', icon: 'wallet', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 1, isSystem: true, isArchived: false },
  { id: 'cat_bonus', name: '奖金', type: 'income', icon: 'coins', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 2, isSystem: true, isArchived: false },
  { id: 'cat_invest', name: '理财', type: 'income', icon: 'trending-up', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 3, isSystem: true, isArchived: false },
  { id: 'cat_parttime', name: '兼职', type: 'income', icon: 'briefcase', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 4, isSystem: true, isArchived: false },
  { id: 'cat_refund', name: '退款', type: 'income', icon: 'receipt', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 5, isSystem: true, isArchived: false },
  { id: 'cat_other_in', name: '其他', type: 'income', icon: 'plus-circle', color: 'var(--ink-secondary)', colorClass: 'cat-salary', sortOrder: 6, isSystem: true, isArchived: false },

  { id: 'cat_redpacket', name: '红包', type: 'income', icon: 'gift', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 7, isSystem: true, isArchived: true },
  { id: 'cat_resale', name: '变现', type: 'income', icon: 'package', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 8, isSystem: true, isArchived: true },
  { id: 'cat_provident', name: '公积', type: 'income', icon: 'landmark', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 9, isSystem: true, isArchived: true },
  { id: 'cat_interest', name: '利息', type: 'income', icon: 'coins', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 10, isSystem: true, isArchived: true },

  { id: 'cat_lend_out', name: '借给他人', type: 'loan', icon: 'arrow-up-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 1, isSystem: true },
  { id: 'cat_borrow_in', name: '向人借款', type: 'loan', icon: 'arrow-down-left', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 2, isSystem: true },
  { id: 'cat_loan_repay', name: '收回还款', type: 'loan', icon: 'check-circle-2', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 3, isSystem: true },
  { id: 'cat_debt_clear', name: '偿还欠款', type: 'loan', icon: 'corner-down-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 4, isSystem: true },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  { id: 'acct_default', name: '默认账户', type: 'cash', balance: 0, currency: 'CNY', icon: 'wallet', sortOrder: 1 },
];
