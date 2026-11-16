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
      const force = (targetX - s.dropletX) * 320;
      s.dropletVelX = (s.dropletVelX + force * dt) * Math.exp(-20 * dt);
      s.dropletX += s.dropletVelX * dt;

      if (Math.abs(targetX - s.dropletX) < 0.1 && Math.abs(s.dropletVelX) < 0.5) {
        s.dropletX = targetX;
        s.dropletVelX = 0;
      }
    }

    const pressRate = pressTarget > s.pressAmount ? 40 : 18;
    s.pressAmount += (pressTarget - s.pressAmount) * Math.min(1, dt * pressRate);

    // Couple uTrigger to active drag pressure, distance to target, and spring velocity:
    const distanceToTarget = Math.abs(targetX - s.dropletX);
    const distFactor = Math.min(1.0, distanceToTarget / Math.max(1, colW * 0.75));
    const velFactor = Math.min(1.0, Math.abs(s.dropletVelX) / 280.0);
    const travelEnergy = Math.max(velFactor, distFactor * 0.65);

    const rawTrigger = Math.min(1.0, Math.max(s.pressAmount, travelEnergy));
    const triggerRate = rawTrigger > s.smoothTrigger ? 40 : 18;
    s.smoothTrigger += (rawTrigger - s.smoothTrigger) * Math.min(1, dt * triggerRate);

    // Resting: inset neatly inside dock (dropHalfH = dockH * 0.425 = 25.5px)
    // Lifted (uTrigger -> 1): swells lifted droplet (+7px halfW, +8px halfH)
    const stretchX = Math.min(8.0, Math.abs(s.dropletVelX) * 0.015);
    const dropHalfW = colW * 0.44 + s.smoothTrigger * 7.0 + stretchX;
    const dropHalfH = dockH * 0.425 + s.smoothTrigger * 8.0;

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
