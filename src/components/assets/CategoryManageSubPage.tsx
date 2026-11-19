import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArchiveRestore } from 'lucide-react';
import { useCategoryStore } from '../../stores/useCategoryStore';
import type { Category } from '../../types/category';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { SegToggle } from '../ui/SegToggle';
import { PaperModal } from '../ui/PaperModal';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { cn } from '../../utils/cn';

const CATEGORY_ICON_CHOICES = [
  'utensils',
  'coffee',
  'train-front',
  'fuel',
  'shopping-cart',
  'shirt',
  'house',
  'clapperboard',
  'book-open',
  'smartphone',
  'heart-pulse',
  'graduation-cap',
  'car',
  'bike',
  'laptop',
  'camera',
  'headphones',
  'gamepad-2',
  'watch',
  'tv',
  'armchair',
  'package',
  'briefcase',
  'wallet',
  'coins',
  'trending-up',
  'landmark',
  'banknote',
  'credit-card',
  'receipt',
  'plus-circle',
  'box',
];

export const CategoryManageSubPage: React.FC = () => {
  const { categories, createCategory, updateCategory, removeCategory } = useCategoryStore();
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [iconInput, setIconInput] = useState('shopping-cart');
  const [isSaving, setIsSaving] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.type === activeType && !c.isArchived),
    [categories, activeType]
  );

  const archivedCategories = useMemo(
    () => categories.filter((c) => c.type === activeType && c.isArchived),
    [categories, activeType]
  );

  const openCreateModal = () => {
    setEditingCat(null);
    setNameInput('');
    setIconInput(activeType === 'income' ? 'wallet' : 'shopping-cart');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setNameInput(cat.name);
    setIconInput(cat.icon || 'shopping-cart');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error('请输入分类名称');
      return;
    }

    const duplicate = categories.find(
      (c) =>
        c.type === activeType &&
        c.id !== editingCat?.id &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      toast.error('已存在同名分类');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, { name: trimmed, icon: iconInput });
        toast.success(`已更新分类「${trimmed}」`);
      } else {
        await createCategory({
          name: trimmed,
          type: activeType,
          icon: iconInput,
        });
        toast.success(`已新增分类「${trimmed}」`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存分类失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (cat: Category) => {
    if (activeCategories.length <= 1) {
      toast.error('至少需保留一个可用分类');
      return;
    }

    const confirmed = await confirmAction({
      title: '删除分类',
      message: `确认删除分类「${cat.name}」吗？`,
      confirmText: '确认删除',
      isDestructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      const res = await removeCategory(cat.id);
      toast.success(
        res.archived
          ? `该分类已有历史流水，已停用「${cat.name}」`
          : `已删除分类「${cat.name}」`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleRestore = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { isArchived: false });
      toast.success(`已恢复分类「${cat.name}」`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复失败');
    }
  };

  return (
    <div className="w-full px-4 pt-2 pb-10 space-y-4 select-none">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-[180px]">
          <SegToggle
            options={[
              { value: 'expense', label: '支出' },
              { value: 'income', label: '收入' },
            ]}
            value={activeType}
            onChange={setActiveType}
            size="sm"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="h-8 px-3 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-2" />
          <span>新增分类</span>
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-xs font-mono text-(--ink-tertiary)">
          <span>{activeType === 'expense' ? '支出分类' : '收入分类'}</span>
          <span>共 {activeCategories.length} 项</span>
        </div>

        <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs divide-y divide-dashed divide-(--rule-hairline)/60">
          {activeCategories.map((cat) => {
            const IconComp = getCategoryIcon(cat.icon);
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary) flex items-center justify-center shrink-0">
                    <IconComp className="w-3.5 h-3.5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-(--ink-primary) truncate block">
                      {cat.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-pointer"
                    title="编辑分类"
                  >
                    <Pencil className="w-3.5 h-3.5 stroke-[1.8]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(cat)}
                    className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-tertiary) hover:text-(--color-expense) hover:bg-(--color-expense-bg)/50 transition-colors cursor-pointer"
                    title="删除分类"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {archivedCategories.length > 0 && (
        <div className="space-y-1.5">
          <div className="px-1 text-xs font-mono text-(--ink-tertiary)">
            <span>已停用分类</span>
          </div>

          <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs divide-y divide-dashed divide-(--rule-hairline)/60 opacity-80">
            {archivedCategories.map((cat) => {
              const IconComp = getCategoryIcon(cat.icon);
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-faint) flex items-center justify-center shrink-0">
                      <IconComp className="w-3.5 h-3.5 stroke-[1.8]" />
                    </div>
                    <span className="text-[13px] text-(--ink-tertiary) line-through truncate">
                      {cat.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(cat)}
                    className="px-2.5 py-1 rounded-(--btn-radius) text-xs font-medium text-(--color-income) bg-(--color-income-bg) flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <ArchiveRestore className="w-3 h-3 stroke-2" />
                    <span>恢复</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PaperModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCat ? '编辑分类' : activeType === 'expense' ? '新增支出分类' : '新增收入分类'}
        subtitle="设置分类名称与图标"
      >
        <form onSubmit={handleSave} className="p-4 space-y-4 select-none">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">分类名称</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={activeType === 'expense' ? '例如：宠物、零食、运动' : '例如：兼职、礼金'}
              maxLength={12}
              autoFocus
              className="w-full h-10 px-3 text-sm rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) placeholder:text-(--ink-faint) outline-none focus:border-(--ink-tertiary)"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">选择图标</label>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_CHOICES.map((iconName) => {
                const IconComp = getCategoryIcon(iconName);
                const isSelected = iconInput === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIconInput(iconName)}
                    className={cn(
                      'h-9 rounded-(--badge-radius) border flex items-center justify-center transition-all cursor-pointer',
                      isSelected
                        ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) border-transparent'
                        : 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline) hover:text-(--ink-primary)'
                    )}
                  >
                    <IconComp className="w-4 h-4 stroke-[1.8]" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? '保存中...' : editingCat ? '保存修改' : '确认添加'}
            </button>
          </div>
        </form>
      </PaperModal>
    </div>
  );
};

export default CategoryManageSubPage;
