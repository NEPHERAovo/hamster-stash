import { useRef } from 'react';

export interface LiquidSpringState {
  dropletX: number;
  dropletVelX: number;
  pressAmount: number;
  smoothTrigger: number;
  dropHalfW: number;
  dropHalfH: number;
}

export function useLiquidSpring() {
  const stateRef = useRef({
    dropletX: null as number | null,
    dropletVelX: 0,
    pressAmount: 0,
    smoothTrigger: 0,
  });

  const step = (
    dt: number,
    targetX: number,
    isDragging: boolean,
    pressTarget: number,
    colW: number,
    dockH: number
  ): LiquidSpringState => {
    const s = stateRef.current;

    if (s.dropletX === null) {
      s.dropletX = targetX;
    }

    if (!isDragging) {
      const force = (targetX - s.dropletX) * 280;
      s.dropletVelX = (s.dropletVelX + force * dt) * Math.exp(-17 * dt);
      s.dropletX += s.dropletVelX * dt;
    }

    const pressRate = pressTarget > s.pressAmount ? 26 : 12;
    s.pressAmount += (pressTarget - s.pressAmount) * Math.min(1, dt * pressRate);

    const glideEnergy = Math.min(1.0, Math.abs(s.dropletVelX) / 360.0);
    const rawTrigger = Math.min(1.0, Math.max(s.pressAmount, glideEnergy));
    const triggerRate = rawTrigger > s.smoothTrigger ? 24 : 9;
    s.smoothTrigger += (rawTrigger - s.smoothTrigger) * Math.min(1, dt * triggerRate);

    const stretchX = Math.min(10, Math.abs(s.dropletVelX) * 0.016);
    const dropHalfW = colW * 0.48 + s.smoothTrigger * 6.5 + stretchX;
    const dropHalfH = dockH * 0.41 + s.smoothTrigger * 8.0;

    return {
      dropletX: s.dropletX,
      dropletVelX: s.dropletVelX,
      pressAmount: s.pressAmount,
      smoothTrigger: s.smoothTrigger,
      dropHalfW,
      dropHalfH,
    };
  };

  const setDragPosition = (x: number) => {
    stateRef.current.dropletX = x;
    stateRef.current.dropletVelX = 0;
  };

  const resetTarget = (targetX: number) => {
    stateRef.current.dropletX = targetX;
    stateRef.current.dropletVelX = 0;
  };

  return {
    step,
    setDragPosition,
    resetTarget,
  };
}
