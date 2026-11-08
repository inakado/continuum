import { describe, expect, it } from 'vitest';
import { pointGeometry } from './point-geometry.generated';
import { projectPoint } from './point-position-model';
import { DISPLACEMENT_DURATION, DISPLACEMENT_START, DISPLACEMENT_END, DISPLACEMENT_ROUTES, displacementAt, displacementFrame, displacementGeometry } from './displacement-model';

describe('path and displacement', () => {
  const view = pointGeometry.view;
  const routes = Object.fromEntries(DISPLACEMENT_ROUTES.map((route) => [route, displacementGeometry(route, view)])) as Record<typeof DISPLACEMENT_ROUTES[number], ReturnType<typeof displacementGeometry>>;
  it('preserves endpoints when the route changes and closes the return route exactly', () => {
    for (const route of DISPLACEMENT_ROUTES) {
      expect(displacementAt(route, 0)).toEqual(DISPLACEMENT_START);
      expect(displacementAt(route, 1)).toEqual(route === 'return' ? DISPLACEMENT_START : DISPLACEMENT_END);
      for (const point of routes[route].world) expect(point.every((value) => value >= 0 && value <= 6)).toBe(true);
    }
  });
  it('changes the path while keeping the final displacement the same', () => {
    const line = displacementFrame(DISPLACEMENT_DURATION, view, routes.line), arc = displacementFrame(DISPLACEMENT_DURATION, view, routes.arc);
    expect(line.path).toBeCloseTo(line.distance, 10);
    expect(arc.path).toBeGreaterThan(line.path + 1);
    const exactArc = Math.hypot(line.distance, 12) / 2 + line.distance ** 2 / 24 * Math.asinh(12 / line.distance);
    expect(arc.path).toBeCloseTo(exactArc, 4);
    expect(arc.distance).toBe(line.distance);
    expect(arc.displacement.vector).toBe(line.displacement.vector);
  });
  it('returns with positive path and zero displacement, without an arrow or negative zero', () => {
    const state = displacementFrame(DISPLACEMENT_DURATION, view, routes.return);
    expect(state.path).toBeGreaterThan(10);
    expect(state.distance).toBe(0);
    expect(state.displacement.arrow).toBe('');
    expect(state.separate).toBe(false);
  });
  it('has non-decreasing path, S ≤ L and a consistent projected position at every frame', () => {
    for (const route of DISPLACEMENT_ROUTES) {
      let previous = 0;
      for (let step = 0; step <= 200; step++) {
        const state = displacementFrame(step / 200 * DISPLACEMENT_DURATION, view, routes[route]);
        expect(state.path).toBeGreaterThanOrEqual(previous);
        expect(state.path + 1e-9).toBeGreaterThanOrEqual(state.distance);
        const projected = projectPoint(state.world, view);
        expect(state.point[0]).toBeCloseTo(projected[0], 10);
        expect(state.point[1]).toBeCloseTo(projected[1], 10);
        expect(state.pointLabel.every(Number.isFinite)).toBe(true);
        expect(state.trail + state.displacement.vector + state.radius.arrow).not.toMatch(/NaN|Infinity/);
        previous = state.path;
      }
    }
  });
  it('clamps scrubbing and starts both lengths at zero', () => {
    expect(displacementFrame(-10, view, routes.arc).path).toBe(0);
    expect(displacementFrame(NaN, view, routes.arc).distance).toBe(0);
    expect(displacementFrame(20, view, routes.arc)).toEqual(displacementFrame(10, view, routes.arc));
  });
  it('keeps labels continuous through every route and fades coincident radius vectors', () => {
    for (const route of DISPLACEMENT_ROUTES) {
      let previous = displacementFrame(0, view, routes[route]);
      for (let step = 1; step <= 2000; step++) {
        const frame = displacementFrame(step / 2000 * DISPLACEMENT_DURATION, view, routes[route]);
        expect(Math.abs(frame.radiusOpacity - previous.radiusOpacity)).toBeLessThan(.05);
        expect(frame.initialRadiusLabel).toEqual(previous.initialRadiusLabel);
        if (frame.separate && previous.separate) {
          for (const key of ['radius', 'displacement'] as const) expect(Math.hypot(frame[key].label[0] - previous[key].label[0], frame[key].label[1] - previous[key].label[1])).toBeLessThan(3);
        }
        previous = frame;
      }
    }
  });
});
