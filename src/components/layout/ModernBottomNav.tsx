import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { LiquidGlassDock } from '../ui/liquid-glass/LiquidGlassDock';
import { cn } from '../../utils/cn';

export interface ModernBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  className?: string;
}

export const ModernBottomNav: React.FC<ModernBottomNavProps> = ({
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
      { id: 'ledger', label: '账本', order: 10 },
      { id: 'stats', label: '统计', order: 20 },
      { id: 'assets', label: '资产', order: 40 },
    ];

    const mappedPluginTabs = pluginTabs.map((pt) => ({
      id: pt.id,
      label: pt.label,
      order: pt.order ?? 30,
    }));

    return [...builtinTabs, ...mappedPluginTabs].sort((a, b) => a.order - b.order);
  }, [pluginTabs]);

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
};

export default ModernBottomNav;
