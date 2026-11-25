import React, { useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon as Plus, TrashIcon as Trash2, DotsSixVerticalIcon as GripVertical } from '@phosphor-icons/react';
import { useCategoryStore } from '../../stores/useCategoryStore';
import type { Category } from '../../types/category';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { SegToggle } from '../ui/SegToggle';
import { PaperModal } from '../ui/PaperModal';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { SwipeableRow } from '../ui/SwipeableRow';
import { PaperSwitch } from '../ui/PaperSwitch';
import { PaperButton } from '../ui/PaperButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperIconButton } from '../ui/PaperIconButton';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { cn } from '../../utils/cn';

const CATEGORY_ICON_CHOICES = [
  'utensils',
  'bowl-food',
  'coffee',
  'wine',
  'orange-slice',
  'basket',
  'shopping-cart',
  'bag',
  'train-front',
  'bus',
  'taxi',
  'car',
  'fuel',
  'bike',
  'airplane',
  'map-pin',
  'shirt',
  'magic-wand',
  'spray-bottle',
  'house',
  'bed',
  'armchair',
  'wrench',
  'lightning',
  'water',
  'tv',
  'clapperboard',
  'music',
  'gamepad-2',
  'camera',
  'headphones',
  'laptop',
  'smartphone',
  'cloud',
  'watch',
  'sport',
  'ticket',
  'book-open',
  'graduation-cap',
  'paperclip',
  'briefcase',
  'heart-pulse',
  'hand-heart',
  'firstaid',
  'shield-check',
  'baby',
  'pet',
  'gift',
  'users',
  'wallet',
  'coins',
  'banknote',
  'credit-card',
  'landmark',
  'receipt',
  'calendar-clock',
  'percent',
  'trending-up',
  'trophy',
  'scales',
  'package',
  'subscription',
  'plus-circle',
  'squares-four',
];

interface SwipeableCategoryRowProps {
  cat: Category;
  index: number;
  isDragging: boolean;
  showDragHandle?: boolean;
  onSelect: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleActive: (cat: Category) => void;
  onDragStartHtml5?: (e: React.DragEvent, index: number) => void;
  onDragOverHtml5?: (e: React.DragEvent) => void;
  onDragEnterHtml5?: (index: number) => void;
  onDragEndHtml5?: () => void;
  onDropHtml5?: (e: React.DragEvent) => void;
  onTouchRowStart?: (e: React.TouchEvent, index: number) => void;
  onTouchRowMove?: (e: React.TouchEvent) => void;
  onTouchRowEnd?: (e: React.TouchEvent) => void;
  onTouchHandleStart?: (e: React.TouchEvent, index: number) => void;
}

const SwipeableCategoryRow: React.FC<SwipeableCategoryRowProps> = ({
  cat,
  index,
  isDragging,
  showDragHandle,
  onSelect,
  onDelete,
  onToggleActive,
  onDragStartHtml5,
  onDragOverHtml5,
  onDragEnterHtml5,
  onDragEndHtml5,
  onDropHtml5,
  onTouchRowStart,
  onTouchRowMove,
  onTouchRowEnd,
  onTouchHandleStart,
}) => {
  const IconComp = getCategoryIcon(cat.icon);
  const isEnabled = !cat.isArchived;

  return (
    <SwipeableRow
      data-category-row="true"
      data-category-id={cat.id}
      containerClassName={cn(
        'bg-(--paper-sheet) select-none',
        isDragging && 'border-2 border-dashed border-(--rule-strong) bg-(--paper-sunken) opacity-25',
        !isEnabled && 'bg-(--paper-sunken)/30 opacity-60'
      )}
      className="flex cursor-pointer items-center justify-between bg-(--paper-sheet) px-3.5 py-2.5 hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      action={{
        label: '删除',
        title: '删除',
        icon: <Trash2 className="size-4 stroke-2" />,
        onClick: () => onDelete(cat),
      }}
      onClick={() => onSelect(cat)}
    >
      <div
        className="mr-2 flex min-w-0 flex-1 touch-manipulation items-center gap-2.5"
        onTouchStart={onTouchRowStart ? (e) => onTouchRowStart(e, index) : undefined}
        onTouchMove={onTouchRowMove}
        onTouchEnd={onTouchRowEnd}
        onTouchCancel={onTouchRowEnd}
      >
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius)',
            isEnabled
              ? 'bg-(--paper-sunken) text-(--ink-secondary)'
              : 'bg-(--paper-sunken) text-(--ink-tertiary)'
          )}
        >
          <IconComp className="stroke-1.8 size-3.5" />
        </div>
        <span
          className={cn(
            'truncate text-[13px] font-medium',
            isEnabled ? 'text-(--ink-primary)' : 'text-(--ink-secondary)'
          )}
        >
          {cat.name}
        </span>
      </div>

      <div
        className="flex shrink-0 items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <PaperSwitch
          checked={isEnabled}
          onChange={() => onToggleActive(cat)}
          aria-label={isEnabled ? '停用' : '启用'}
        />

        {showDragHandle && onDragStartHtml5 && (
          <div
            draggable
            onDragStart={(e) => onDragStartHtml5(e, index)}
            onDragOver={onDragOverHtml5}
            onDragEnter={() => onDragEnterHtml5?.(index)}
            onDragEnd={onDragEndHtml5}
            onDrop={onDropHtml5}
            onTouchStart={onTouchHandleStart ? (e) => onTouchHandleStart(e, index) : undefined}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-(--btn-radius) text-(--ink-tertiary) transition-colors select-none hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:cursor-grabbing"
            title="排序"
          >
            <GripVertical className="stroke-1.8 size-4" />
          </div>
        )}
      </div>
    </SwipeableRow>
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
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const activeDragIndexRef = useRef<number | null>(null);

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

  const [dragList, setDragList] = useState<Category[] | null>(null);
  const dragListRef = useRef<Category[] | null>(null);
  dragListRef.current = dragList;

  const displayActiveCategories = dragList ?? activeCategories;

  const commitReorder = useCallback(
    async (newList: Category[]) => {
      try {
        await reorderCategories(newList.map((c) => c.id));
      } catch {
        toast.error('保存排序失败');
      }
    },
    [reorderCategories]
  );

  const startDragOperation = useCallback(
    (startIndex: number, clientX: number, clientY: number) => {
      isDraggingRef.current = true;
      activeDragIndexRef.current = startIndex;
      setDraggingIndex(startIndex);
      setGhostPos({ x: clientX, y: clientY });
      const initialList = [...activeCategories];
      dragListRef.current = initialList;
      setDragList(initialList);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(15);
        } catch {
          void 0;
        }
      }

      const container = containerRef.current;
      if (!container) return;

      const rowElements = Array.from(
        container.querySelectorAll<HTMLElement>('[data-category-row]')
      );
      if (rowElements.length === 0) return;

      const firstRect = rowElements[0].getBoundingClientRect();
      const rowHeight = firstRect.height || 44;
      const startTop = firstRect.top;
      const totalActiveRows = initialList.length;
      let curIdx = startIndex;

      const onWindowTouchMove = (moveEvt: TouchEvent) => {
        if (moveEvt.cancelable) {
          moveEvt.preventDefault();
        }
        const touch = moveEvt.touches[0];
        setGhostPos({ x: touch.clientX, y: touch.clientY });

        const targetIdx = Math.max(
          0,
          Math.min(totalActiveRows - 1, Math.floor((touch.clientY - startTop) / rowHeight))
        );

        if (targetIdx !== curIdx && targetIdx >= 0 && targetIdx < totalActiveRows) {
          const currentList = dragListRef.current ?? [...activeCategories];
          const next = [...currentList];
          const [moved] = next.splice(curIdx, 1);
          next.splice(targetIdx, 0, moved);
          dragListRef.current = next;
          setDragList(next);
          curIdx = targetIdx;
          activeDragIndexRef.current = targetIdx;
          setDraggingIndex(targetIdx);

          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(8);
            } catch {
              void 0;
            }
          }
        }
      };

      const onWindowTouchEnd = () => {
        window.removeEventListener('touchmove', onWindowTouchMove);
        window.removeEventListener('touchend', onWindowTouchEnd);
        window.removeEventListener('touchcancel', onWindowTouchEnd);

        isDraggingRef.current = false;
        setDraggingIndex(null);
        setGhostPos(null);
        activeDragIndexRef.current = null;

        const finalList = dragListRef.current;
        setDragList(null);

        if (finalList && curIdx !== startIndex) {
          commitReorder(finalList);
        }

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(10);
          } catch {
            void 0;
          }
        }
      };

      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd);
      window.addEventListener('touchcancel', onWindowTouchEnd);
    },
    [activeCategories, commitReorder]
  );

  const handleRowTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }

      longPressTimerRef.current = window.setTimeout(() => {
        startDragOperation(index, touch.clientX, touch.clientY);
        longPressTimerRef.current = null;
      }, 240);
    },
    [startDragOperation]
  );

  const handleRowTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || isDraggingRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (dx > 8 || dy > 8) {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handleRowTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleTouchHandleStart = useCallback(
    (e: React.TouchEvent, startIndex: number) => {
      e.stopPropagation();
      const touch = e.touches[0];
      startDragOperation(startIndex, touch.clientX, touch.clientY);
    },
    [startDragOperation]
  );

  const handleDragStartHtml5 = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    const initialList = [...activeCategories];
    dragListRef.current = initialList;
    setDragList(initialList);
    setDraggingIndex(index);
  };

  const handleDragOverHtml5 = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterHtml5 = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const currentList = dragListRef.current ?? [...activeCategories];
    if (targetIndex >= currentList.length) return;
    const next = [...currentList];
    const [moved] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, moved);
    dragListRef.current = next;
    setDragList(next);
    setDraggingIndex(targetIndex);
  };

  const handleDragEndHtml5 = () => {
    const finalList = dragListRef.current;
    setDraggingIndex(null);
    setDragList(null);
    if (finalList) {
      commitReorder(finalList);
    }
  };

  const handleDropHtml5 = (e: React.DragEvent) => {
    e.preventDefault();
    const finalList = dragListRef.current;
    setDraggingIndex(null);
    setDragList(null);
    if (finalList) {
      commitReorder(finalList);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    const isCurrentlyActive = !cat.isArchived;
    if (isCurrentlyActive && activeCategories.length <= 1) {
      toast.error('至少需保留一个可用分类');
      return;
    }
    try {
      await updateCategory(cat.id, { isArchived: isCurrentlyActive });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
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

  const handleSave = async (e: React.SyntheticEvent) => {
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
        await updateCategory(editingCat.id, {
          name: trimmed,
          icon: iconInput,
        });
      } else {
        await createCategory({
          name: trimmed,
          type: activeType,
          icon: iconInput,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存分类失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (cat: Category) => {
    if (activeCategories.length <= 1 && !cat.isArchived) {
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

  let submitLabel = '确认添加';
  if (isSaving) {
    submitLabel = '保存中...';
  } else if (editingCat) {
    submitLabel = '保存修改';
  }

  const draggingCat = draggingIndex !== null ? displayActiveCategories[draggingIndex] : null;
  const GhostIconComp = draggingCat ? getCategoryIcon(draggingCat.icon) : null;
  const totalCategoryCount = displayActiveCategories.length + archivedCategories.length;

  return (
    <div className="w-full space-y-4 px-4 pt-2 pb-28 select-none">
      <div className="w-full">
        <SegToggle
          options={[
            { value: 'expense', label: '支出' },
            { value: 'income', label: '收入' },
          ]}
          value={activeType}
          onChange={setActiveType}
          size="sm"
          fullWidth
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 font-mono text-xs text-(--ink-tertiary)">
          <span>分类列表</span>
          <span>共 {totalCategoryCount} 项</span>
        </div>

        <div
          ref={containerRef}
          className="paper-card divide-y divide-dashed divide-(--rule-hairline)/60 overflow-hidden rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs"
        >
          {displayActiveCategories.map((cat, idx) => (
            <SwipeableCategoryRow
              key={cat.id}
              cat={cat}
              index={idx}
              isDragging={draggingIndex === idx}
              showDragHandle={true}
              onSelect={openEditModal}
              onDelete={handleRemove}
              onToggleActive={handleToggleActive}
              onDragStartHtml5={handleDragStartHtml5}
              onDragOverHtml5={handleDragOverHtml5}
              onDragEnterHtml5={handleDragEnterHtml5}
              onDragEndHtml5={handleDragEndHtml5}
              onDropHtml5={handleDropHtml5}
              onTouchRowStart={handleRowTouchStart}
              onTouchRowMove={handleRowTouchMove}
              onTouchRowEnd={handleRowTouchEnd}
              onTouchHandleStart={handleTouchHandleStart}
            />
          ))}

          {archivedCategories.map((cat, idx) => (
            <SwipeableCategoryRow
              key={cat.id}
              cat={cat}
              index={displayActiveCategories.length + idx}
              isDragging={false}
              showDragHandle={false}
              onSelect={openEditModal}
              onDelete={handleRemove}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      </div>

      {ghostPos && draggingCat && GhostIconComp && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${ghostPos.x}px`,
              top: `${ghostPos.y}px`,
              transform: 'translate(-50%, -50%) scale(1.04) rotate(-1.2deg)',
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '90vw',
              maxWidth: '92vw',
              zIndex: 9999,
            }}
            className="pointer-events-none flex items-center justify-between rounded-(--radius-lg) border border-(--rule-strong) bg-(--paper-sheet) px-3.5 py-2.5 opacity-95 shadow-2xl transition-transform duration-75 select-none"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-solid)">
                <GhostIconComp className="stroke-1.8 size-3.5" />
              </div>
              <span className="truncate text-[13px] font-semibold text-(--ink-primary)">
                {draggingCat.name}
              </span>
            </div>
            <div className="flex size-7 shrink-0 items-center justify-center text-(--ink-primary)">
              <GripVertical className="stroke-1.8 size-4" />
            </div>
          </div>,
          document.body
        )}

      <PaperModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCat ? '编辑分类' : '新增分类'}
      >
        <form onSubmit={handleSave} className="space-y-4 p-4 select-none">
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-(--ink-tertiary)">分类名称</label>
            <PaperInput
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="输入分类名称"
              maxLength={12}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs text-(--ink-tertiary)">选择图标</label>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_CHOICES.map((iconName) => {
                const IconComp = getCategoryIcon(iconName);
                const isSelected = iconInput === iconName;
                return (
                  <PaperIconButton
                    key={iconName}
                    icon={IconComp}
                    size="md"
                    className="flex aspect-square h-auto w-full items-center justify-center"
                    variant={isSelected ? 'primary' : 'sunken'}
                    onClick={() => setIconInput(iconName)}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <PaperButton
              type="button"
              variant="sunken"
              className="flex-1"
              onClick={() => setIsModalOpen(false)}
            >
              取消
            </PaperButton>
            <PaperButton
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isSaving}
              loading={isSaving}
            >
              {submitLabel}
            </PaperButton>
          </div>

          {editingCat && (
            <div className="border-t border-(--rule-hairline) pt-2 pb-(--safe-bottom)">
              <PaperButton
                type="button"
                variant="danger-ghost"
                size="sm"
                fullWidth
                leftIcon={<Trash2 className="size-3.5 stroke-2" />}
                onClick={() => {
                  setIsModalOpen(false);
                  handleRemove(editingCat);
                }}
              >
                删除分类
              </PaperButton>
            </div>
          )}
        </form>
      </PaperModal>

      <FloatingActionButton
        icon={Plus}
        onClick={openCreateModal}
        title="新增分类"
        placement="corner"
      />
    </div>
  );
};

export default CategoryManageSubPage;
