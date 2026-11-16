export type CategoryType = 'income' | 'expense' | 'loan';

export interface Category {
  id: string;
  name: string;               // 分类名，如 "餐饮"
  type: CategoryType;         // 分类类型
  icon: string;               // Lucide 图标名称，如 'utensils' | 'train-front'
  color: string;              // 低饱和色彩变量，如 'var(--cat-food)'
  colorClass?: string;        // CSS 类名，如 'cat-food'
  parentId?: string;          // 二级分类支持
  sortOrder: number;          // 排序权重
  isSystem?: boolean;         // 是否系统预置
  isArchived?: boolean;       // 是否归档
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}
