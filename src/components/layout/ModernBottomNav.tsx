import React, { useMemo } from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { LiquidGlassDock } from '../ui/liquid-glass/LiquidGlassDock';
import type { DockTabItem } from '../ui/liquid-glass/drawDockTexture';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { cn } from '../../utils/cn';

export interface ModernBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  addButtonTitle?: string;
  className?: string;
  tabs?: DockTabItem[];
}

export const ModernBottomNav: React.FC<ModernBottomNavProps> = ({
  currentTab,
  onTabChange,
  onAddClick,
  showAddButton = false,
  isAddOpen = false,
  addButtonTitle,
  className,
  tabs,
}) => {
  const pluginTabs = usePluginUIStore((s) => s.navTabs);

  const getDefaultTitle = () => {
    if (isAddOpen) return '收起便签';
    if (currentTab === 'items') return '新建物品';
    if (currentTab === 'assets') return '新建账户';
    return '记账';
  };
  const resolvedAddTitle = addButtonTitle || getDefaultTitle();

  const allTabs: DockTabItem[] = useMemo(() => {
    if (tabs && tabs.length > 0) {
      return tabs;
    }

    const builtinTabs: DockTabItem[] = [
      { id: 'ledger', label: '账本', order: 10 },
      { id: 'stats', label: '统计', order: 20 },
      { id: 'assets', label: '资产', order: 40 },
    ];

    const mappedPluginTabs: DockTabItem[] = pluginTabs.map((pt) => ({
      id: pt.id,
      label: pt.label,
      icon: typeof pt.icon === 'string' ? pt.icon : undefined,
      order: pt.order ?? 30,
    }));

    return [...builtinTabs, ...mappedPluginTabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [pluginTabs, tabs]);

  return (
    <>
      {showAddButton && onAddClick && (
        <FloatingActionButton
          onClick={onAddClick}
          title={resolvedAddTitle}
          rotated={isAddOpen}
          placement="dock"
        />
      )}

      <div
        className={cn(
          'pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-4 pb-(--dock-bottom) select-none',
          className
        )}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-[366px]">
          <LiquidGlassDock
            className="h-[58px]"
            tabs={allTabs}
            activeTab={currentTab}
            onTabChange={onTabChange}
          />
        </div>
      </div>
    </>
  );
};

export default ModernBottomNav;
