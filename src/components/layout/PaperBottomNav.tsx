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
        <div className="fixed bottom-[calc(var(--nav-height)+var(--paper-safe-bottom)+12px)] left-1/2 -translate-x-1/2 w-full max-w-[430px] pointer-events-none z-40">
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

      <nav className={cn('fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50', className)}>
        <div className="absolute inset-x-0 bottom-0 top-3.5 bg-(--paper-sunken) border-t border-(--rule-hairline)" />
        <div className="relative z-10 flex items-end justify-center h-[calc(52px+var(--paper-safe-bottom))] px-6 gap-1">
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center border border-(--rule-hairline) border-b-0 rounded-t-md pb-(--paper-safe-bottom) transition-all cursor-pointer select-none gap-0.5 min-w-0',
                  isActive
                    ? 'relative z-10 h-[calc(3rem+var(--paper-safe-bottom))] bg-(--paper-sheet) text-(--ink-solid) shadow-[0_-2px_6px_rgba(0,0,0,0.03)]'
                    : 'relative z-1 h-[calc(2.625rem+var(--paper-safe-bottom))] bg-(--paper-sunken) text-(--ink-faint) hover:text-(--ink-secondary)'
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2 : 1.75}
                  className="shrink-0"
                />
                <span className="text-[9px] font-semibold leading-tight font-sans truncate px-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default PaperBottomNav;
