import React from 'react';
import { SettingsCard, type SettingsCardProps } from './SettingsCard';
import { useSwipeBack } from '../../hooks/useSwipeBack';

export interface SettingsSubPageProps extends SettingsCardProps {
  onClose: () => void;
}

export const SettingsSubPage: React.FC<SettingsSubPageProps> = ({
  isDark,
  onToggleDark,
  onOpenImport,
  onClose,
}) => {
  const swipeRef = useSwipeBack<HTMLDivElement>({ onClose });

  return (
    <div ref={swipeRef} className="w-full pb-8 animate-fade-in select-none">
      <div className="px-4 pt-2">
        <SettingsCard
          isDark={isDark}
          onToggleDark={onToggleDark}
          onOpenImport={onOpenImport}
        />
      </div>
    </div>
  );
};

export default SettingsSubPage;
