import { usePluginUIStore } from '../../core/plugin/SlotStore';

export function usePluginNavigation() {
  const openSubPage = usePluginUIStore((s) => s.openSubPage);
  const closeSubPage = usePluginUIStore((s) => s.closeSubPage);
  const openModal = usePluginUIStore((s) => s.openModal);
  const closeModal = usePluginUIStore((s) => s.closeModal);

  return {
    openSubPage,
    closeSubPage,
    openModal,
    closeModal,
  };
}
