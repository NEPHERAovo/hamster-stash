import { useRef } from 'react';

export interface LiquidSpringState {
  dropletX: number;
  dropletVelX: number;
  pressAmount: number;
  smoothTrigger: number;
  dropHalfW: number;
  dropHalfH: number;
  dropR: number;
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
      const force = (targetX - s.dropletX) * 80;
      s.dropletVelX = (s.dropletVelX + force * dt) * Math.exp(-16 * dt);
      s.dropletX += s.dropletVelX * dt;

      if (Math.abs(targetX - s.dropletX) < 0.1 && Math.abs(s.dropletVelX) < 0.5) {
        s.dropletX = targetX;
        s.dropletVelX = 0;
      }
    }

    const pressRate = pressTarget > s.pressAmount ? 16 : 10;
    s.pressAmount += (pressTarget - s.pressAmount) * Math.min(1, dt * pressRate);

    const distToTarget = Math.abs(targetX - s.dropletX);
    const distEnergy = Math.min(1.0, distToTarget / Math.max(1, colW * 0.75));
    const velEnergy = Math.min(1.0, Math.abs(s.dropletVelX) / 240.0);
    const travelEnergy = Math.max(velEnergy, distEnergy * 0.75);

    const rawTrigger = Math.min(1.0, Math.max(s.pressAmount, travelEnergy));
    const triggerRate = rawTrigger > s.smoothTrigger ? 32 : 12;
    s.smoothTrigger += (rawTrigger - s.smoothTrigger) * Math.min(1, dt * triggerRate);

    const stretchX = Math.min(8.0, Math.abs(s.dropletVelX) * 0.012);
    const baseHalfH = Math.round(dockH * 0.388 * 2) / 2;
    const baseHalfW = 41.85;
    const baseDropR = 20.0;

    const dropHalfH = baseHalfH + s.smoothTrigger * 14.5;
    const dropHalfW = baseHalfW + s.smoothTrigger * 14.5 + stretchX;
    const dropR = s.smoothTrigger > 0.02 ? baseDropR + (dropHalfH * 0.85 - baseDropR) * s.smoothTrigger : baseDropR;

    return {
      dropletX: s.dropletX,
      dropletVelX: s.dropletVelX,
      pressAmount: s.pressAmount,
      smoothTrigger: s.smoothTrigger,
      dropHalfW,
      dropHalfH,
      dropR,
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
