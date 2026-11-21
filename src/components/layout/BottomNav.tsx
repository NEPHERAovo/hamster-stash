import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { PaperBottomNav } from './PaperBottomNav';
import { ModernBottomNav } from './ModernBottomNav';
import type { DockTabItem } from '../ui/liquid-glass/drawDockTexture';

export type NavTab = 'ledger' | 'stats' | 'assets' | string;

export interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onAddClick?: () => void;
  showAddButton?: boolean;
  isAddOpen?: boolean;
  addButtonTitle?: string;
  className?: string;
  tabs?: DockTabItem[];
}

export const BottomNav: React.FC<BottomNavProps> = (props) => {
  const uiStyle = useThemeStore((s) => s.uiStyle);

  if (uiStyle === 'modern') {
    return <ModernBottomNav {...props} />;
  }

  return <PaperBottomNav {...props} />;
};

export default BottomNav;
