import React, { useMemo } from 'react';
import { NotebookText, BarChart3, Wallet, Plus, type LucideIcon } from 'lucide-react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { cn } from '../../utils/cn';

export interface PaperBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  className?: string;
  tabs?: Array<{ id?: string; label?: string; order?: number }>;
}

export const PaperBottomNav: React.FC<PaperBottomNavProps> = ({
  currentTab,
  onTabChange,
  onAddClick,
  showAddButton = false,
  isAddOpen = false,
  className,
}) => {
  const pluginTabs = usePluginUIStore((s) => s.navTabs);

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
      {showAddButton && onAddClick && (
        <div className="fixed bottom-[calc(64px+var(--dock-bottom))] left-1/2 -translate-x-1/2 w-full max-w-[430px] pointer-events-none z-40">
          <button
            type="button"
            onClick={onAddClick}
            title={isAddOpen ? '收起便签' : '提笔入账'}
            aria-label={isAddOpen ? '收起便签' : '提笔入账'}
            className="pointer-events-auto absolute right-4.5 bottom-0 w-[46px] h-[46px] rounded-md bg-(--ink-solid) text-(--paper-sheet) shadow-[0_4px_14px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.12)] flex items-center justify-center hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus
              className={cn(
                'w-5 h-5 stroke-[2.2] transition-transform duration-200',
                isAddOpen && 'rotate-45'
              )}
            />
          </button>
        </div>
      )}

      <nav className={cn('fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 pb-(--dock-bottom) px-4 pointer-events-none select-none', className)}>
        <div className="pointer-events-auto relative pt-[3px]">
          <div
            className="absolute inset-x-0 bottom-0 h-12 rounded-[5px] bg-(--paper-sunken) border border-(--rule-hairline) shadow-[0_6px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.42)]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-end gap-1 px-1 pb-1">
            {allTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center border border-b-0 rounded-t-[3.5px] rounded-b-[2px] overflow-hidden transition-[height,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.22,1.2,0.36,1)] cursor-pointer select-none gap-0.5 min-w-0',
                    isActive
                      ? 'relative z-10 h-[47px] pt-[3px] bg-(--paper-sheet) border-(--rule-hairline) text-(--ink-solid) shadow-[0_-1px_5px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.05)]'
                      : 'relative z-1 h-10 bg-transparent border-transparent text-(--ink-tertiary) hover:text-(--ink-secondary)'
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute top-0 inset-x-0 h-[3px] bg-(--color-accent)"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.1 : 1.75}
                    className="shrink-0"
                  />
                  <span className="text-[10px] font-semibold leading-none font-sans truncate px-0.5">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px] rounded-b-[5px] z-20 bg-(--paper-sunken) border-t border-(--rule-hairline)/90"
            aria-hidden="true"
          />
        </div>
      </nav>
    </>
  );
};

export default PaperBottomNav;
