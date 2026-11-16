import React, { useMemo } from 'react';
import { NotebookText, BarChart3, Wallet, Plus, type LucideIcon } from 'lucide-react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { LiquidGlassDock } from '../ui/liquid-glass/LiquidGlassDock';
import { cn } from '../../utils/cn';

export type NavTab = 'ledger' | 'stats' | 'assets' | string;

export interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onAddClick,
  showAddButton = false,
  isAddOpen = false,
  className,
}) => {
  const pluginTabs = usePluginUIStore((s) => s.navTabs);
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

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

  if (isModern) {
    return (
      <div
        className={cn(
          'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 pb-[calc(14px+var(--safe-bottom))] px-3.5 pointer-events-none select-none',
          className
        )}
      >
        <div className="flex items-center gap-2.5 w-full pointer-events-auto">
          <div className="flex-1 min-w-0">
            <LiquidGlassDock
              tabs={allTabs.map((t) => ({ id: t.id, label: t.label }))}
              activeTab={currentTab}
              onTabChange={onTabChange}
            />
          </div>

          {showAddButton && onAddClick && (
            <button
              type="button"
              onClick={onAddClick}
              title={isAddOpen ? '收起便签' : '记一笔'}
              aria-label={isAddOpen ? '收起便签' : '记一笔'}
              className="w-[58px] h-[58px] rounded-full bg-[#1677ff] dark:bg-[#4d94ff] text-white flex items-center justify-center shadow-[0_10px_24px_-4px_rgba(22,119,255,0.42)] active:scale-90 transition-all cursor-pointer shrink-0"
            >
              <Plus
                className={cn(
                  'w-6 h-6 stroke-[2.4] transition-transform duration-200',
                  isAddOpen && 'rotate-45'
                )}
              />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {showAddButton && onAddClick && (
        <div className="fixed bottom-[calc(var(--nav-height)+var(--safe-bottom)+12px)] left-1/2 -translate-x-1/2 w-full max-w-[430px] pointer-events-none z-40">
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

      <nav className={cn('fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 pb-(--safe-bottom)', className)}>
        <div className="relative flex items-end justify-center h-[52px] px-6 gap-1 before:absolute before:bottom-0 before:left-0 before:right-0 before:h-9 before:bg-(--paper-sunken) before:border-t before:border-(--rule-hairline)">
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center border border-(--rule-hairline) border-b-0 rounded-t-md transition-all cursor-pointer select-none gap-0.5 min-w-0',
                  isActive
                    ? 'relative z-10 h-12 bg-(--paper-sheet) text-(--ink-solid) shadow-[0_-2px_6px_rgba(0,0,0,0.03)]'
                    : 'relative z-1 h-10.5 bg-(--paper-sunken) text-(--ink-faint) hover:text-(--ink-secondary)'
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

export default BottomNav;
