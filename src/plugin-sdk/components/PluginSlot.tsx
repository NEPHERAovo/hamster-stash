import React from 'react';
import { usePluginUIStore } from '../../core/plugin/SlotStore';
import type { SlotDescriptor } from '../../core/plugin/types';

const EMPTY_SLOTS: SlotDescriptor[] = [];

export interface PluginSlotProps {
  name: string;
  context?: Record<string, unknown>;
  className?: string;
  wrapperClassName?: string;
}

export const PluginSlot: React.FC<PluginSlotProps> = ({
  name,
  context,
  className,
  wrapperClassName,
}) => {
  const slots = usePluginUIStore((s) => s.slots[name] ?? EMPTY_SLOTS);
  const enabledPlugins = usePluginUIStore((s) => s.enabledPlugins);

  const activeSlots = slots.filter((slot) => enabledPlugins[slot.pluginId] !== false);

  if (activeSlots.length === 0) {
    return null;
  }

  if (wrapperClassName) {
    return (
      <div className={wrapperClassName}>
        {activeSlots.map((slot, index) => (
          <React.Fragment key={`${slot.pluginId}_${name}_${index}`}>
            {slot.render({ ...context, className })}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <>
      {activeSlots.map((slot, index) => (
        <React.Fragment key={`${slot.pluginId}_${name}_${index}`}>
          {slot.render({ ...context, className })}
        </React.Fragment>
      ))}
    </>
  );
};
