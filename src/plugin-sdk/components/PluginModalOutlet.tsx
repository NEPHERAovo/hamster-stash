import React from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';

export const PluginModalOutlet: React.FC = () => {
  const activeModal = usePluginUIStore((s) => s.activeModal);
  const closeModal = usePluginUIStore((s) => s.closeModal);

  if (!activeModal) return null;

  const Component = activeModal.component;
  return <Component onClose={closeModal} params={activeModal.params} />;
};
