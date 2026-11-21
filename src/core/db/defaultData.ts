import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 1, isSystem: true, isArchived: false, subTags: ['三餐', '外卖', '水果', '零食咖啡', '买菜'] },
  { id: 'cat_market', name: '日用超市', type: 'expense', icon: 'basket', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 2, isSystem: true, isArchived: false, subTags: ['超市采购', '日用品', '生鲜果蔬', '家居收纳'] },
  { id: 'cat_transit', name: '交通出行', type: 'expense', icon: 'train-front', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 3, isSystem: true, isArchived: false, subTags: ['公交地铁', '打车', '加油充电', '机票火车'] },
  { id: 'cat_shop', name: '购物消费', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 4, isSystem: true, isArchived: false, subTags: ['服饰鞋包', '数码配件', '美妆护肤', '日常网购'] },
  { id: 'cat_home', name: '居家生活', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 5, isSystem: true, isArchived: false, subTags: ['水电煤气', '房租房贷', '话费宽带', '物业维修'] },
  { id: 'cat_fun', name: '休闲娱乐', type: 'expense', icon: 'clapperboard', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 6, isSystem: true, isArchived: false, subTags: ['聚会请客', '电影演出', '游戏充值', '休闲爱好'] },
  { id: 'cat_health', name: '医疗保健', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 7, isSystem: true, isArchived: false, subTags: ['门诊就诊', '药房买药', '体检疫苗', '健康保障'] },
  { id: 'cat_other', name: '其他支出', type: 'expense', icon: 'subscription', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 8, isSystem: true, isArchived: false, subTags: ['人情礼金', '学习提升', '意外支出', '杂费'] },

  { id: 'cat_pet', name: '宠物生灵', type: 'expense', icon: 'pet', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 9, isSystem: true, isArchived: true, subTags: ['宠物食品', '医疗防疫', '用品玩具', '洗护美容'] },
  { id: 'cat_digital', name: '数码应用', type: 'expense', icon: 'laptop', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 10, isSystem: true, isArchived: true, subTags: ['电脑数码', '手机周边', '软件订阅', '网络服务'] },
  { id: 'cat_edu', name: '学习进修', type: 'expense', icon: 'graduation-cap', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 11, isSystem: true, isArchived: true, subTags: ['培训课程', '书籍材料', '考试报名', '文具用具'] },
  { id: 'cat_social', name: '人情社交', type: 'expense', icon: 'gift', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 12, isSystem: true, isArchived: true, subTags: ['节日送礼', '人情礼金', '请客聚餐', '孝敬长辈'] },
  { id: 'cat_car', name: '汽车支出', type: 'expense', icon: 'car', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 13, isSystem: true, isArchived: true, subTags: ['加油充能', '停车过路', '维修保养', '车险车检'] },
  { id: 'cat_travel', name: '旅游度假', type: 'expense', icon: 'airplane', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 14, isSystem: true, isArchived: true, subTags: ['机票高铁', '酒店住宿', '景点门票', '旅行消费'] },
  { id: 'cat_beauty', name: '美容美发', type: 'expense', icon: 'subscription', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 15, isSystem: true, isArchived: true, subTags: ['理发造型', '护肤医美', '美甲SPA', '形象设计'] },
  { id: 'cat_baby', name: '母婴育儿', type: 'expense', icon: 'baby', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 16, isSystem: true, isArchived: true, subTags: ['奶粉辅食', '童装尿裤', '早教玩具', '母婴护理'] },
  { id: 'cat_sport', name: '运动健身', type: 'expense', icon: 'sport', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 17, isSystem: true, isArchived: true, subTags: ['健身卡费', '运动装备', '场馆预订', '私教课程'] },
  { id: 'cat_clothes', name: '服饰装扮', type: 'expense', icon: 'shirt', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 18, isSystem: true, isArchived: true, subTags: ['衣服裤子', '鞋履配饰', '内衣服饰', '洗衣护理'] },
  { id: 'cat_comm', name: '通信网络', type: 'expense', icon: 'smartphone', color: 'var(--cat-comm)', colorClass: 'cat-comm', sortOrder: 19, isSystem: true, isArchived: true, subTags: ['手机话费', '家庭宽带', '流量充值', '云存储'] },
  { id: 'cat_coffee', name: '咖啡茶饮', type: 'expense', icon: 'coffee', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 20, isSystem: true, isArchived: true, subTags: ['现磨咖啡', '奶茶果汁', '茶叶茶包', '烘焙甜点'] },
  { id: 'cat_fruit', name: '新鲜水果', type: 'expense', icon: 'basket', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 21, isSystem: true, isArchived: true, subTags: ['时令水果', '进口果品', '果切拼盘', '干果蜜饯'] },
  { id: 'cat_office', name: '办公商务', type: 'expense', icon: 'briefcase', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 22, isSystem: true, isArchived: true, subTags: ['办公用纸', '耗材文具', '差旅公杂', '商务宴请'] },
  { id: 'cat_lottery', name: '彩票博彩', type: 'expense', icon: 'ticket', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 23, isSystem: true, isArchived: true, subTags: ['福利彩票', '体育彩票', '刮刮乐', '赛事竞猜'] },
  { id: 'cat_repair', name: '家居维修', type: 'expense', icon: 'wrench', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 24, isSystem: true, isArchived: true, subTags: ['家电报修', '管道五金', '锁具门窗', '墙面翻新'] },
  { id: 'cat_donate', name: '慈善公益', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 25, isSystem: true, isArchived: true, subTags: ['公益捐款', '爱心帮扶', '物资捐赠', '志愿者'] },
  { id: 'cat_hotel', name: '住宿短租', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 26, isSystem: true, isArchived: true, subTags: ['酒店宾馆', '民宿短租', '公寓合租', '露营青旅'] },

  { id: 'cat_salary', name: '工资薪酬', type: 'income', icon: 'wallet', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 1, isSystem: true, isArchived: false },
  { id: 'cat_bonus', name: '奖金补贴', type: 'income', icon: 'coins', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 2, isSystem: true, isArchived: false },
  { id: 'cat_invest', name: '理财投资', type: 'income', icon: 'trending-up', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 3, isSystem: true, isArchived: false },
  { id: 'cat_parttime', name: '兼职副业', type: 'income', icon: 'briefcase', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 4, isSystem: true, isArchived: false },
  { id: 'cat_refund', name: '退款退税', type: 'income', icon: 'receipt', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 5, isSystem: true, isArchived: false },
  { id: 'cat_other_in', name: '其他收入', type: 'income', icon: 'plus-circle', color: 'var(--ink-secondary)', colorClass: 'cat-salary', sortOrder: 6, isSystem: true, isArchived: false },

  { id: 'cat_redpacket', name: '红包礼金', type: 'income', icon: 'gift', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 7, isSystem: true, isArchived: true },
  { id: 'cat_resale', name: '二手变现', type: 'income', icon: 'package', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 8, isSystem: true, isArchived: true },
  { id: 'cat_provident', name: '公积金', type: 'income', icon: 'landmark', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 9, isSystem: true, isArchived: true },
  { id: 'cat_interest', name: '存款利息', type: 'income', icon: 'coins', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 10, isSystem: true, isArchived: true },

  { id: 'cat_lend_out', name: '借给他人', type: 'loan', icon: 'arrow-up-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 1, isSystem: true },
  { id: 'cat_borrow_in', name: '向人借款', type: 'loan', icon: 'arrow-down-left', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 2, isSystem: true },
  { id: 'cat_loan_repay', name: '收回还款', type: 'loan', icon: 'check-circle-2', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 3, isSystem: true },
  { id: 'cat_debt_clear', name: '偿还欠款', type: 'loan', icon: 'corner-down-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 4, isSystem: true },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  { id: 'acct_default', name: '默认账户', type: 'cash', balance: 0, currency: 'CNY', icon: 'wallet', sortOrder: 1 },
];
