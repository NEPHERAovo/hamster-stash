import type { CsvColumnMapping } from './csvMapper';

export interface ImportPreset {
  id: string;
  name: string;
  badge?: string;
  shortDesc: string;
  description: string;
  iconName: string;
  defaultMapping: CsvColumnMapping;
  categoryAliases?: Record<string, string>;
  tips?: string[];
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    id: 'elephant',
    name: '小象记账',
    badge: '标准格式',
    shortDesc: '自动匹配分类与报销标记',
    description: '支持小象记账导出的账单 CSV，自动识别日期、分类、收支、金额、账户及报销。',
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
      '饮品': '餐饮',
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
    ],
  },
  {
    id: 'standard',
    name: '通用 CSV',
    badge: '自定义映射',
    shortDesc: '自主映射表格列与分类',
    description: '自由配置列名与分类对照关系，支持任意表格文件。',
    iconName: 'sliders',
    defaultMapping: {},
    tips: [
      '确保表格中至少包含「日期」和「金额」列',
    ],
  },
];
