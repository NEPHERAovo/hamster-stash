import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiquidSpring } from '../../src/components/ui/liquid-glass/useLiquidSpring';

describe('useLiquidSpring', () => {
  it('initializes dropletX to targetX on first step', () => {
    const { result } = renderHook(() => useLiquidSpring());
    const state = result.current.step(0.016, 50, false, 0, 80, 58);

    expect(state.dropletX).toBe(50);
    expect(state.dropletVelX).toBe(0);
    expect(state.pressAmount).toBe(0);
    expect(state.dropHalfH).toBeGreaterThan(0);
    expect(state.dropHalfW).toBeGreaterThan(0);
  });

  it('smoothly steps toward targetX and settles within reasonable frames', () => {
    const { result } = renderHook(() => useLiquidSpring());

    act(() => {
      result.current.step(0.016, 0, false, 0, 80, 58);
    });

    const targetX = 120;
    const dt = 0.016;
    let finalState = result.current.step(dt, targetX, false, 0, 80, 58);

    for (let i = 0; i < 30; i++) {
      act(() => {
        finalState = result.current.step(dt, targetX, false, 0, 80, 58);
      });
    }

    expect(Math.abs(finalState.dropletX - targetX)).toBeLessThan(1.0);
    expect(Math.abs(finalState.dropletVelX)).toBeLessThan(5.0);
  });

  it('allows dragging override via setDragPosition', () => {
    const { result } = renderHook(() => useLiquidSpring());

    act(() => {
      result.current.step(0.016, 50, false, 0, 80, 58);
      result.current.setDragPosition(150);
    });

    const state = result.current.step(0.016, 200, true, 0, 80, 58);
    expect(state.dropletX).toBe(150);
    expect(state.dropletVelX).toBe(0);
  });

  it('increases and decreases pressAmount based on pressTarget', () => {
    const { result } = renderHook(() => useLiquidSpring());

    let state = result.current.step(0.016, 50, false, 1.0, 80, 58);
    for (let i = 0; i < 5; i++) {
      act(() => {
        state = result.current.step(0.016, 50, false, 1.0, 80, 58);
      });
    }
    expect(state.pressAmount).toBeGreaterThan(0.5);

    for (let i = 0; i < 15; i++) {
      act(() => {
        state = result.current.step(0.016, 50, false, 0.0, 80, 58);
      });
    }
    expect(state.pressAmount).toBeLessThan(0.1);
  });

  it('resets target position via resetTarget', () => {
    const { result } = renderHook(() => useLiquidSpring());

    act(() => {
      result.current.step(0.016, 50, false, 0, 80, 58);
      result.current.resetTarget(200);
    });

    const state = result.current.step(0.016, 200, false, 0, 80, 58);
    expect(state.dropletX).toBe(200);
    expect(state.dropletVelX).toBe(0);
  });
});
