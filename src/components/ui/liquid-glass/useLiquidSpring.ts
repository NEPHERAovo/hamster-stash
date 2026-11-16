import { useRef } from 'react';

export interface LiquidSpringState {
  dropletX: number;
  dropletVelX: number;
  pressAmount: number;
  smoothTrigger: number;
  colorTrigger: number;
  dropHalfW: number;
  dropHalfH: number;
}

export function useLiquidSpring() {
  const stateRef = useRef({
    dropletX: null as number | null,
    dropletVelX: 0,
    pressAmount: 0,
    smoothTrigger: 0,
    colorTrigger: 0,
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

    const pressRate = pressTarget > s.pressAmount ? 48 : 22;
    s.pressAmount += (pressTarget - s.pressAmount) * Math.min(1, dt * pressRate);

    // Couple triggers to active drag pressure, distance to target, and spring velocity:
    const distanceToTarget = Math.abs(targetX - s.dropletX);
    const distFactor = Math.min(1.0, distanceToTarget / Math.max(1, colW * 0.75));
    const velFactor = Math.min(1.0, Math.abs(s.dropletVelX) / 280.0);
    const travelEnergy = Math.max(velFactor, distFactor * 0.65);

    const rawTrigger = Math.min(1.0, Math.max(s.pressAmount, travelEnergy));

    // Snappy size trigger: jumps quickly on press/glide
    const sizeRate = rawTrigger > s.smoothTrigger ? 48 : 22;
    s.smoothTrigger += (rawTrigger - s.smoothTrigger) * Math.min(1, dt * sizeRate);

    // Slower color trigger: morphs gracefully between resting gray pill and crystal lens
    const colorRate = rawTrigger > s.colorTrigger ? 12 : 10;
    s.colorTrigger += (rawTrigger - s.colorTrigger) * Math.min(1, dt * colorRate);

    // Exact iOS native 1.58:1 aspect ratio:
    // Resting: height 53px, width ~84px (4.5px vertical padding inside 62px dock)
    // Lifted: expands proportionally by ~36% into generous oval dome (height 72px, width ~114px)
    const stretchX = Math.min(6.0, Math.abs(s.dropletVelX) * 0.012);
    const baseHalfH = dockH * 0.427; // ~26.5px for 62px dock
    const baseHalfW = baseHalfH * 1.58; // ~41.9px (width ~83.7px)
    const dropHalfH = baseHalfH + s.smoothTrigger * 9.5;
    const dropHalfW = baseHalfW + s.smoothTrigger * 15.0 + stretchX;

    return {
      dropletX: s.dropletX,
      dropletVelX: s.dropletVelX,
      pressAmount: s.pressAmount,
      smoothTrigger: s.smoothTrigger,
      colorTrigger: s.colorTrigger,
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
