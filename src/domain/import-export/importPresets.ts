import type { CsvColumnMapping } from './csvMapper';

export interface ImportPreset {
  id: string;
  name: string;
  badge?: string;
  shortDesc: string;
  description: string;
  iconName: string; // Lucide icon
  defaultMapping: CsvColumnMapping;
  categoryAliases?: Record<string, string>;
  tips?: string[];
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    id: 'elephant',
    name: '小象记账',
    badge: '推荐适配',
    shortDesc: '小象记账 App 标准导出 CSV',
    description: '支持小象记账导出的全量账单 CSV，自动识别日期、分类、收支、金额、账户及报销标记。',
    iconName: 'sparkles',
    defaultMapping: {
      dateCol: '日期',
      categoryCol: '分类名称',
      typeCol: '收支',
      amountCol: '金额',
      accountCol: '账户',
      noteCol: '备注',
      reimburseCol: '报销',
    },
    categoryAliases: {
      '吃饭': '餐饮',
      '饮品': '饮品',
      '超市': '购物',
      '购物': '购物',
      '交通费': '交通',
      '出行': '交通',
      '生活': '居住',
      '水电': '居住',
      '房租': '居住',
      '水果': '餐饮',
      '娱乐': '娱乐',
      '电影': '娱乐',
      '通讯': '通讯',
      '话费': '通讯',
      '医疗': '医疗',
      '教育': '教育',
      '工资': '工资',
      '兼职': '奖金',
    },
    tips: [
      '在小象记账「我的」-「数据管理」中导出 CSV 文件',
      '自动识别「是否报销」状态与对应垫付分类',
    ],
  },
  {
    id: 'wechat',
    name: '微信支付',
    badge: '账单流水',
    shortDesc: '微信钱包导出的个人账单',
    description: '自动解析微信支付明细 CSV，智能跳过文件前置说明行，提取商户、支付方式与金额。',
    iconName: 'message-circle',
    defaultMapping: {
      dateCol: '交易时间',
      typeCol: '收/支',
      amountCol: '金额(元)',
      categoryCol: '交易类型',
      accountCol: '支付方式',
      noteCol: '商品',
    },
    categoryAliases: {
      '商户消费': '购物',
      '扫二维码付款': '餐饮',
      '微信红包': '其他收入',
      '转账': '其他收入',
      '亲属卡交易': '居住',
      '群收款': '其他收入',
    },
    tips: [
      '在微信「我」-「服务」-「钱包」-「账单」右上角常见问题中「导出账单」',
      '解压后导入对应的 csv 格式账单文件',
    ],
  },
  {
    id: 'alipay',
    name: '支付宝',
    badge: '账单流水',
    shortDesc: '支付宝 App 导出的账单明细',
    description: '适配支付宝交易记录明细 CSV，自动识别交易分类、商品说明、收付款方式与实付金额。',
    iconName: 'zap',
    defaultMapping: {
      dateCol: '交易时间',
      typeCol: '收/支',
      amountCol: '金额',
      categoryCol: '交易分类',
      accountCol: '收/付款方式',
      noteCol: '商品说明',
    },
    categoryAliases: {
      '餐饮美食': '餐饮',
      '日用百货': '购物',
      '交通出行': '交通',
      '充值缴费': '通讯',
      '文化休闲': '娱乐',
      '数码电器': '购物',
      '服饰装扮': '购物',
      '生活服务': '居住',
      '医疗健康': '医疗',
      '收入': '工资',
    },
    tips: [
      '在支付宝「我的」-「账单」右上角「...」-「开具交易流水证明 / 导出」中导出',
      '支持个人消费与经营类流水智能分类',
    ],
  },
  {
    id: 'qianji',
    name: '钱迹',
    badge: '记账软件',
    shortDesc: '钱迹导出的标准账单备份',
    description: '支持钱迹导出的 CSV 账本，自动映射时间、分类、类型、金额与账户1等字段。',
    iconName: 'wallet-cards',
    defaultMapping: {
      dateCol: '时间',
      categoryCol: '分类',
      typeCol: '类型',
      amountCol: '金额',
      accountCol: '账户1',
      noteCol: '备注',
    },
    tips: ['在钱迹「设置」-「数据备份与导出」中导出 CSV 格式账单'],
  },
  {
    id: 'shark',
    name: '鲨鱼记账',
    badge: '记账软件',
    shortDesc: '鲨鱼记账导出的明细数据',
    description: '支持鲨鱼记账导出的 CSV 格式文件，包含日期、类别、类型、金额和账户。',
    iconName: 'fish',
    defaultMapping: {
      dateCol: '日期',
      categoryCol: '类别',
      typeCol: '类型',
      amountCol: '金额',
      accountCol: '账户',
      noteCol: '备注',
    },
    tips: ['在鲨鱼记账「我的」-「导出账单」中获取 CSV 文件'],
  },
  {
    id: 'feidee',
    name: '随手记',
    badge: '记账软件',
    shortDesc: '随手记标准流水导出',
    description: '兼容随手记导出的多账本流水 CSV，支持分类、交易类型与金额匹配。',
    iconName: 'notebook-pen',
    defaultMapping: {
      dateCol: '交易时间',
      typeCol: '交易类型',
      categoryCol: '类别',
      amountCol: '金额',
      accountCol: '账户',
      noteCol: '备注',
    },
    tips: ['在随手记网页端或 App 设置中导出明细数据'],
  },
  {
    id: 'standard',
    name: '通用 CSV',
    badge: '自定义映射',
    shortDesc: '支持任意记账软件或 Excel 表格',
    description: '自主配置列映射与分类对照关系，适合其它未收录记账软件或手工自制表格。',
    iconName: 'sliders',
    defaultMapping: {},
    tips: [
      '确保表格中至少包含「日期」和「金额」两列',
      '可自定义将任意列对应到「仓鼠囤囤」系统字段',
    ],
  },
];
