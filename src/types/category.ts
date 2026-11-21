export type CategoryType = 'income' | 'expense' | 'loan';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  colorClass?: string;
  parentId?: string;
  sortOrder: number;
  isSystem?: boolean;
  isArchived?: boolean;
  subTags?: string[];
  createdAt: string;
  updatedAt: string;
}
