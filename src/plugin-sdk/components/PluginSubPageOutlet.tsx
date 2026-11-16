import React from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';

export const PluginSubPageOutlet: React.FC = () => {
  const activeSubPage = usePluginUIStore((s) => s.activeSubPage);
  const closeSubPage = usePluginUIStore((s) => s.closeSubPage);

  if (!activeSubPage) return null;

  const Component = activeSubPage.component;
  return (
    <div className="absolute inset-0 z-40 bg-(--paper-base) flex flex-col overflow-y-auto overscroll-contain">
      <Component onClose={closeSubPage} params={activeSubPage.params} />
    </div>
  );
};
