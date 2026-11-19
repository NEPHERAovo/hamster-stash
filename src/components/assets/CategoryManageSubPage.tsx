import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ArchiveRestore, GripVertical } from 'lucide-react';
import { useCategoryStore } from '../../stores/useCategoryStore';
import type { Category } from '../../types/category';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { SegToggle } from '../ui/SegToggle';
import { PaperModal } from '../ui/PaperModal';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { cn } from '../../utils/cn';
import {
  SPRING_OUT_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
} from '../../utils/gesturePhysics';

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

const ACTION_WIDTH = 72;

interface SwipeableCategoryRowProps {
  cat: Category;
  index: number;
  isDragging: boolean;
  onSelect: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onDragStartHtml5: (e: React.DragEvent, index: number) => void;
  onDragOverHtml5: (e: React.DragEvent) => void;
  onDragEnterHtml5: (index: number) => void;
  onDragEndHtml5: () => void;
  onDropHtml5: (e: React.DragEvent) => void;
  onTouchHandleStart: (e: React.TouchEvent, index: number) => void;
}

const SwipeableCategoryRow: React.FC<SwipeableCategoryRowProps> = ({
  cat,
  index,
  isDragging,
  onSelect,
  onDelete,
  onDragStartHtml5,
  onDragOverHtml5,
  onDragEnterHtml5,
  onDragEndHtml5,
  onDropHtml5,
  onTouchHandleStart,
}) => {
  const IconComp = getCategoryIcon(cat.icon);
  const [offset, setOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [settleMs, setSettleMs] = useState<number>(240);

  const isDraggingRef = useRef<boolean>(false);
  const isHorizontalRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentOffsetRef = useRef<number>(0);
  const velocityRef = useRef<VelocityTracker>(new VelocityTracker());
  const lastTouchTimeRef = useRef<number>(0);

  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    isHorizontalRef.current = false;
    startXRef.current = clientX;
    startYRef.current = clientY;
    velocityRef.current.reset(currentOffsetRef.current, performance.now());
  };

  const handleDragMove = (
    clientX: number,
    clientY: number,
    preventDefault?: () => void
  ) => {
    if (!isDraggingRef.current) return;
    const rawDx = clientX - startXRef.current + currentOffsetRef.current;
    const deltaY = Math.abs(clientY - startYRef.current);
    const deltaX = Math.abs(clientX - (startXRef.current + currentOffsetRef.current));

    if (!isHorizontalRef.current) {
      if (deltaY > deltaX && deltaY > 6) {
        isDraggingRef.current = false;
        return;
      }
      if (deltaX > 6) {
        isHorizontalRef.current = true;
        setIsSwiping(true);
      }
    }

    if (isHorizontalRef.current) {
      preventDefault?.();
      let newOffset = rawDx;
      if (newOffset > 0) {
        newOffset = rubberBand(newOffset, 48, 0.25);
      } else if (newOffset < -ACTION_WIDTH) {
        const overflow = -newOffset - ACTION_WIDTH;
        newOffset = -ACTION_WIDTH - rubberBand(overflow, 140, 0.48);
      }
      currentOffsetRef.current = newOffset;
      velocityRef.current.push(newOffset, performance.now());
      setOffset(newOffset);
    }
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsSwiping(false);
    lastTouchTimeRef.current = Date.now();

    const vx = velocityRef.current.getVelocity(performance.now());
    const shouldOpen =
      vx < -0.35
        ? currentOffsetRef.current < -16
        : vx > 0.35
          ? false
          : currentOffsetRef.current < -ACTION_WIDTH / 2;

    const target = shouldOpen ? -ACTION_WIDTH : 0;
    setSettleMs(computeSettleDuration(target - currentOffsetRef.current, vx, 190, 300));
    currentOffsetRef.current = target;
    setOffset(target);
  };

  const handleRowClick = () => {
    if (Date.now() - lastTouchTimeRef.current < 400) {
      return;
    }
    if (offset < 0) {
      currentOffsetRef.current = 0;
      setOffset(0);
    } else {
      onSelect(cat);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    currentOffsetRef.current = 0;
    setOffset(0);
    onDelete(cat);
  };

  const actionTranslate = Math.max(0, ACTION_WIDTH + offset);
  const actionWidth = Math.max(ACTION_WIDTH, Math.ceil(Math.abs(offset)));
  const actionOpacity = offset === 0 ? 0 : Math.min(1, Math.abs(offset) / 30);

  return (
    <div
      data-category-row="true"
      data-category-id={cat.id}
      className={cn(
        'relative overflow-hidden bg-(--paper-sheet) select-none',
        isDragging && 'opacity-60 bg-(--paper-sunken)'
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 right-0 bg-(--color-expense) flex items-center justify-center z-0 overflow-hidden select-none',
          offset === 0 && 'pointer-events-none opacity-0'
        )}
        style={{
          width: `${actionWidth}px`,
          transform: `translate3d(${actionTranslate}px, 0, 0)`,
          opacity: actionOpacity,
          transition: isSwiping
            ? 'none'
            : `transform ${settleMs}ms ${SPRING_OUT_EASE}, width ${settleMs}ms ${SPRING_OUT_EASE}, opacity 200ms ease`,
        }}
      >
        <button
          type="button"
          onClick={handleDeleteClick}
          className="w-full h-full flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-0.5 cursor-pointer active:opacity-85"
          title="删除分类"
        >
          <Trash2 className="w-4 h-4 stroke-2" />
          <span>删除</span>
        </button>
      </div>

      <div
        onClick={handleRowClick}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) =>
          handleDragMove(e.touches[0].clientX, e.touches[0].clientY, () =>
            e.cancelable && e.preventDefault()
          )
        }
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        onMouseDown={(e) => {
          if (e.button === 0) handleDragStart(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isDraggingRef.current) handleDragMove(e.clientX, e.clientY, () => e.preventDefault());
        }}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isSwiping ? 'none' : `transform ${settleMs}ms ${SPRING_OUT_EASE}`,
        }}
        className="relative z-10 bg-(--paper-sheet) flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-(--paper-hover) active:bg-(--paper-sunken) select-none will-change-transform"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pointer-events-none">
          <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary) flex items-center justify-center shrink-0">
            <IconComp className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <span className="text-[13px] font-medium text-(--ink-primary) truncate">
            {cat.name}
          </span>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div
            draggable
            onDragStart={(e) => onDragStartHtml5(e, index)}
            onDragOver={onDragOverHtml5}
            onDragEnter={() => onDragEnterHtml5(index)}
            onDragEnd={onDragEndHtml5}
            onDrop={onDropHtml5}
            onTouchStart={(e) => onTouchHandleStart(e, index)}
            className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
            title="拖拽排序"
          >
            <GripVertical className="w-4 h-4 stroke-[1.8]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CategoryManageSubPage: React.FC = () => {
  const { categories, createCategory, updateCategory, removeCategory, reorderCategories } =
    useCategoryStore();
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [iconInput, setIconInput] = useState('shopping-cart');
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const activeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === activeType && !c.isArchived)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories, activeType]
  );

  const archivedCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === activeType && c.isArchived)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories, activeType]
  );

  const [localCategories, setLocalCategories] = useState<Category[]>(activeCategories);
  const localCategoriesRef = useRef(localCategories);
  localCategoriesRef.current = localCategories;

  useEffect(() => {
    setLocalCategories(activeCategories);
  }, [activeCategories]);

  const commitReorder = async (newList: Category[]) => {
    try {
      await reorderCategories(newList.map((c) => c.id));
    } catch {
      toast.error('保存排序失败');
      setLocalCategories(activeCategories);
    }
  };

  const handleTouchHandleStart = (e: React.TouchEvent, startIndex: number) => {
    e.stopPropagation();
    setDraggingIndex(startIndex);

    const container = containerRef.current;
    if (!container) return;

    const rowElements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-category-row]')
    );
    if (rowElements.length === 0) return;

    const firstRect = rowElements[0].getBoundingClientRect();
    const rowHeight = firstRect.height || 44;
    const startTop = firstRect.top;
    const totalRows = rowElements.length;
    let currentIdx = startIndex;

    const onTouchMove = (moveEvt: TouchEvent) => {
      if (moveEvt.cancelable) {
        moveEvt.preventDefault();
      }
      const touchY = moveEvt.touches[0].clientY;
      const targetIdx = Math.max(
        0,
        Math.min(totalRows - 1, Math.floor((touchY - startTop) / rowHeight))
      );

      if (targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < totalRows) {
        const next = [...localCategoriesRef.current];
        const [moved] = next.splice(currentIdx, 1);
        next.splice(targetIdx, 0, moved);
        localCategoriesRef.current = next;
        setLocalCategories(next);
        currentIdx = targetIdx;
      }
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      setDraggingIndex(null);

      if (currentIdx !== startIndex) {
        commitReorder(localCategoriesRef.current);
      }
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  };

  const handleDragStartHtml5 = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggingIndex(index);
  };

  const handleDragOverHtml5 = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterHtml5 = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const next = [...localCategoriesRef.current];
    const [moved] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, moved);
    localCategoriesRef.current = next;
    setLocalCategories(next);
    setDraggingIndex(targetIndex);
  };

  const handleDragEndHtml5 = () => {
    setDraggingIndex(null);
    commitReorder(localCategoriesRef.current);
  };

  const handleDropHtml5 = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingIndex(null);
    commitReorder(localCategoriesRef.current);
  };

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
          <span>共 {localCategories.length} 项</span>
        </div>

        <div
          ref={containerRef}
          className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) overflow-hidden shadow-xs divide-y divide-dashed divide-(--rule-hairline)/60"
        >
          {localCategories.map((cat, idx) => (
            <SwipeableCategoryRow
              key={cat.id}
              cat={cat}
              index={idx}
              isDragging={draggingIndex === idx}
              onSelect={openEditModal}
              onDelete={handleRemove}
              onDragStartHtml5={handleDragStartHtml5}
              onDragOverHtml5={handleDragOverHtml5}
              onDragEnterHtml5={handleDragEnterHtml5}
              onDragEndHtml5={handleDragEndHtml5}
              onDropHtml5={handleDropHtml5}
              onTouchHandleStart={handleTouchHandleStart}
            />
          ))}
        </div>
        <p className="px-1 text-[11px] font-mono text-(--ink-faint) text-right">
          点击编辑 · 拖拽右侧手柄排序 · 向左侧滑删除
        </p>
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

          <div className="flex items-center gap-2 pt-1">
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

          {editingCat && (
            <div className="pt-2 border-t border-(--rule-hairline) pb-(--safe-bottom)">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  handleRemove(editingCat);
                }}
                className="w-full h-9 rounded-(--btn-radius) text-xs font-semibold text-(--color-expense) hover:bg-(--color-expense-bg)/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-2" />
                <span>删除分类</span>
              </button>
            </div>
          )}
        </form>
      </PaperModal>
    </div>
  );
};

export default CategoryManageSubPage;
