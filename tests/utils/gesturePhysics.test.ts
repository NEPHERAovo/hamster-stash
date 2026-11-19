import { describe, it, expect, vi } from 'vitest';
import {
  GestureSmoother,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
  shouldDismissGesture,
} from '../../src/utils/gesturePhysics';

describe('Nonlinear gesture physics utility', () => {
  it('applies smooth monotonic rubber-band damping bounded by dimension', () => {
    expect(rubberBand(0, 100)).toBe(0);
    const small = rubberBand(20, 100, 0.55);
    const medium = rubberBand(100, 100, 0.55);
    const large = rubberBand(1000, 100, 0.55);

    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(20);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
    expect(large).toBeLessThan(100);
    expect(rubberBand(-50, 100, 0.55)).toBeCloseTo(-rubberBand(50, 100, 0.55));
  });

  it('tracks instantaneous velocity within sliding window and zeroes after pause', () => {
    const tracker = new VelocityTracker(100);
    tracker.reset(0, 1000);
    tracker.push(30, 1050);
    tracker.push(90, 1100);

    expect(tracker.getVelocity(1100)).toBeCloseTo(0.9, 2);
    expect(tracker.getVelocity(1250)).toBe(0);
  });

  it('computes faster settle duration for higher release velocities within bounds', () => {
    const slow = computeSettleDuration(260, 0.05, 180, 340);
    const fast = computeSettleDuration(260, 1.4, 180, 340);

    expect(slow).toBeGreaterThan(fast);
    expect(fast).toBeGreaterThanOrEqual(180);
    expect(slow).toBeLessThanOrEqual(340);
  });

  it('evaluates dismiss intent from distance, fling velocity, and reverse-flick cancellation', () => {
    expect(shouldDismissGesture(120, 0.1, 90)).toBe(true);
    expect(shouldDismissGesture(40, 0.65, 90, 0.45)).toBe(true);
    expect(shouldDismissGesture(15, 0.8, 90, 0.45)).toBe(false);
    expect(shouldDismissGesture(120, -0.5, 90)).toBe(false);
  });

  it('filters raw target updates with smooth exponential decay', () => {
    vi.useFakeTimers();
    let currentPos = 0;
    const updateSpy = vi.fn((pos: number) => {
      currentPos = pos;
    });

    const smoother = new GestureSmoother(updateSpy, 0, 26);
    smoother.setTarget(100);

    // Initial instant should not jump directly to 100
    expect(currentPos).toBe(0);

    // Advance 1 frame (~16ms)
    vi.advanceTimersByTime(16);
    expect(currentPos).toBeGreaterThan(0);
    expect(currentPos).toBeLessThan(100);

    // Advance more frames to settle
    vi.advanceTimersByTime(200);
    expect(currentPos).toBeCloseTo(100, 0);

    smoother.stop();
    vi.useRealTimers();
  });
});
