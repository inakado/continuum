import { describe, expect, it } from 'vitest';
import { pointGeometry } from './point-geometry.generated';
import { projectPoint } from './point-position-model';
import { TRAJECTORY_DURATION, trajectoryAt, trajectoryFrame, trajectoryGeometry } from './trajectory-model';

describe('trajectory', () => {
  const view = pointGeometry.view, geometry = trajectoryGeometry(view);
  it('keeps the rising turn inside the coordinate axes', () => {
    for (let i = 0; i <= 240; i++) {
      const p = trajectoryAt(i / 240);
      expect(p.every((value) => value >= 0 && value <= 6)).toBe(true);
      if (i) expect(p[2]).toBeGreaterThan(trajectoryAt((i - 1) / 240)[2]);
    }
  });
  it('starts without a trace and reaches the exact projected endpoint', () => {
    const start = trajectoryFrame(0, view, geometry), end = trajectoryFrame(TRAJECTORY_DURATION, view, geometry);
    expect(start.trail).toBe('');
    expect(start.point).toEqual(projectPoint(trajectoryAt(0), view));
    expect(end.point).toEqual(projectPoint(trajectoryAt(1), view));
    expect(end.vector.endsWith(`L${end.point.map((v) => v.toFixed(2)).join(' ')}`)).toBe(true);
    expect(trajectoryFrame(-4, view, geometry)).toEqual(start);
    expect(trajectoryFrame(100, view, geometry)).toEqual(end);
  });
  it('has a continuous tapered ribbon at every sample and partial step', () => {
    geometry.edges.forEach(({ left, right }, i) => {
      expect(Math.hypot(left[0] - right[0], left[1] - right[1])).toBeCloseTo(4.2 - 3.1 * i / 240);
      const frame = trajectoryFrame((i + .3) / 240 * TRAJECTORY_DURATION, view, geometry);
      expect(frame.trail + frame.vector + frame.arrow).not.toMatch(/NaN|Infinity/);
      expect(frame.trail.endsWith('Z')).toBe(true);
    });
  });
  it('moves the radius label continuously and keeps it clear of its vector', () => {
    let previous = trajectoryFrame(0, view, geometry);
    for (let step = 1; step <= 2400; step++) {
      const frame = trajectoryFrame(step / 2400 * TRAJECTORY_DURATION, view, geometry);
      expect(Math.hypot(frame.label[0] - previous.label[0], frame.label[1] - previous.label[1])).toBeLessThan(2);
      const dx = frame.point[0] - view.origin[0], dy = frame.point[1] - view.origin[1];
      const clearance = Math.abs(dx * (frame.label[1] - 5 - view.origin[1]) - dy * (frame.label[0] - view.origin[0])) / Math.hypot(dx, dy);
      expect(clearance).toBeGreaterThan(20);
      previous = frame;
    }
  });
});
