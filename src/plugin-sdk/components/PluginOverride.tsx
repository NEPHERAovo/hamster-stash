import React from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';

export interface PluginOverrideProps<P extends object = object> {
  point: string;
  fallback: React.ComponentType<P>;
  props: P;
}

export const PluginOverride = <P extends object>({
  point,
  fallback: FallbackComponent,
  props,
}: PluginOverrideProps<P>): React.ReactElement | null => {
  const override = usePluginUIStore((s) => s.overrides[point]);
  const enabledPlugins = usePluginUIStore((s) => s.enabledPlugins);

  if (override && enabledPlugins[override.pluginId] !== false) {
    return <>{override.overrideRender(props as unknown as Record<string, unknown>, FallbackComponent as unknown as React.ComponentType<Record<string, unknown>>)}</>;
  }

  return <FallbackComponent {...props} />;
};
