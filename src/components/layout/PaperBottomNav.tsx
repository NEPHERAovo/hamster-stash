import React, { useMemo } from 'react';
import { BookBookmarkIcon as NotebookText, ChartBarIcon as BarChart3, WalletIcon as Wallet, PlusIcon as Plus, type Icon as LucideIcon } from '@phosphor-icons/react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { cn } from '../../utils/cn';

export interface PaperBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  addButtonTitle?: string;
  className?: string;
  tabs?: Array<{ id?: string; label?: string; order?: number }>;
}

export const PaperBottomNav: React.FC<PaperBottomNavProps> = ({
  currentTab,
  onTabChange,
  onAddClick,
  showAddButton = false,
  isAddOpen = false,
  addButtonTitle,
  className,
}) => {
  const pluginTabs = usePluginUIStore((s) => s.navTabs);

  const getDefaultTitle = () => {
    if (isAddOpen) return '收起便签';
    if (currentTab === 'items') return '新建物品';
    if (currentTab === 'assets') return '新建账户';
    return '记账';
  };
  const resolvedAddTitle = addButtonTitle || getDefaultTitle();

  const allTabs = useMemo(() => {
    const builtinTabs = [
      { id: 'ledger', label: '账本', icon: NotebookText as LucideIcon, order: 10 },
      { id: 'stats', label: '统计', icon: BarChart3 as LucideIcon, order: 20 },
      { id: 'assets', label: '资产', icon: Wallet as LucideIcon, order: 40 },
    ];

    const mappedPluginTabs = pluginTabs.map((pt) => ({
      id: pt.id,
      label: pt.label,
      icon: (typeof pt.icon === 'string' ? getCategoryIcon(pt.icon) : pt.icon) as React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>,
      order: pt.order ?? 30,
    }));

    return [...builtinTabs, ...mappedPluginTabs].sort((a, b) => a.order - b.order);
  }, [pluginTabs]);

  return (
    <>
      <div
        className="pointer-events-none fixed bottom-0 left-1/2 z-30 h-[calc(62px+var(--dock-bottom))] w-full max-w-[430px] -translate-x-1/2 border-t border-(--rule-hairline)/60 bg-gradient-to-t from-(--paper-base)/85 via-(--paper-base)/40 to-transparent backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {showAddButton && onAddClick && (
        <div className="pointer-events-none fixed bottom-[calc(68px+var(--dock-bottom))] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2">
          <button
            type="button"
            onClick={onAddClick}
            title={resolvedAddTitle}
            aria-label={resolvedAddTitle}
            className="pointer-events-auto absolute right-4.5 bottom-0 flex size-[46px] cursor-pointer items-center justify-center rounded-md bg-(--ink-solid) text-(--paper-sheet) shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 active:scale-95 dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
          >
            <Plus
              className={cn(
                'stroke-2.2 size-5 transition-transform duration-200',
                isAddOpen && 'rotate-45'
              )}
            />
          </button>
        </div>
      )}

      <nav className={cn('pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-4 pb-(--dock-bottom) select-none', className)}>
        <div className="pointer-events-auto relative pt-[3px]">
          <div
            className="absolute inset-x-0 bottom-0 h-13 rounded-[5px] border border-(--rule-hairline) bg-(--paper-sunken) shadow-[0_2px_6px_rgba(0,0,0,0.04)] dark:shadow-[0_3px_10px_rgba(0,0,0,0.24)]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-end gap-1 px-1 pb-1">
            {allTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {idx > 0 && (
                    <div
                      className="pointer-events-none mb-0.5 h-4.5 w-0 shrink-0 self-center border-r border-dashed border-(--rule-hairline)/80"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      'relative flex h-[51px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-t-[3.5px] rounded-b-[2px] border border-b-0 pt-[3px] transition-[background-color,border-color,box-shadow,color] duration-200 select-none',
                      isActive
                        ? 'z-10 border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-solid) shadow-[0_-1px_3px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.03)]'
                        : 'z-1 border-transparent bg-transparent text-(--ink-tertiary) hover:text-(--ink-secondary)'
                    )}
                  >
                    <span
                      data-testid={isActive ? 'paper-nav-active-bar' : undefined}
                      className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-(--color-accent) transition-opacity duration-200 ease-out',
                        isActive ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.1 : 1.75}
                      className="shrink-0"
                    />
                    <span className="truncate px-0.5 font-sans text-[10px] leading-none font-semibold">
                      {tab.label}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[5px] rounded-b-[5px] border-t border-(--rule-hairline)/90 bg-(--paper-sunken)"
            aria-hidden="true"
          />
        </div>
      </nav>
    </>
  );
};

export default PaperBottomNav;
