import React from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import { SubPageShell } from '../../components/layout/SubPageShell';

export const PluginSubPageOutlet: React.FC = () => {
  const activeSubPage = usePluginUIStore((s) => s.activeSubPage);
  const closeSubPage = usePluginUIStore((s) => s.closeSubPage);

  return (
    <SubPageShell
      isOpen={Boolean(activeSubPage)}
      onClose={closeSubPage}
      header={null}
    >
      {activeSubPage && (
        <activeSubPage.component onClose={closeSubPage} params={activeSubPage.params} />
      )}
    </SubPageShell>
  );
};
