import { describe, expect, it } from 'vitest';
import { clampPoint, dragPointAxis, dragPointVertical, dragPointXY, pointFrame, projectPoint, type PointView } from './point-position-model';

const view: PointView = { origin: [200, 300], axes: [[-20, 10], [40, 5], [0, -35]] };

describe('point position and radius vector', () => {
  it('converts a screen drag back into XY coordinates while keeping height', () => {
    const point = [2, 3, 4] as const;
    const start = projectPoint(point, view);
    const end = projectPoint([3, 2, 4], view);
    expect(dragPointXY(point, [end[0] - start[0], end[1] - start[1]], view)).toEqual([3, 2, 4]);
  });

  it('changes height directly on vertical drag and follows horizontal motion without a Z slider', () => {
    const point = [2, 3, 4] as const;
    expect(dragPointVertical(point, [0, -35], view)).toEqual([2, 3, 5]);
    const moved = dragPointVertical(point, [40, -35], view);
    const a = projectPoint(point, view), b = projectPoint(moved, view);
    expect(b[0] - a[0]).toBeCloseTo(40);
    expect(b[1] - a[1]).toBeCloseTo(-35);
    expect(moved[2]).toBe(5);
  });

  it('lets each projection change only its own coordinate and stays inside the axes', () => {
    const point = [2, 3, 4] as const;
    for (const axis of [0, 1, 2] as const) {
      const [dx, dy] = view.axes[axis];
      const moved = dragPointAxis(point, [dx, dy], axis, view);
      moved.forEach((value, i) => expect(value).toBe(point[i] + (i === axis ? 1 : 0)));
      expect(dragPointAxis(point, [dx * 100, dy * 100], axis, view)[axis]).toBe(6);
      expect(dragPointAxis(point, [-dx * 100, -dy * 100], axis, view)[axis]).toBe(0);
    }
    expect(dragPointAxis(point, [20, 30], 2, { ...view, axes: [view.axes[0], view.axes[1], [0, 0]] })).toEqual(point);
  });

  it('uses orthogonal 3D projections rather than the apparent screen angles', () => {
    const frame = pointFrame([2, 3, 4], view);
    expect(frame.point).toEqual(projectPoint([2, 3, 4], view));
    expect(frame.feet).toEqual([[160, 320], [320, 315], [200, 160]]);
    expect(frame.length).toBeCloseTo(Math.sqrt(29));
    expect(frame.angles.reduce<number>((sum, angle) => sum + Math.cos((angle ?? 0) * Math.PI / 180) ** 2, 0)).toBeCloseTo(1);
    expect(frame.angles[2]).toBeCloseTo(Math.acos(4 / Math.sqrt(29)) * 180 / Math.PI);
  });

  it('leaves direction angles undefined at the origin', () => {
    const frame = pointFrame([0, 0, 0], view);
    expect(frame.length).toBe(0);
    expect(frame.angles).toEqual([null, null, null]);
    expect(frame.arcs).toEqual(['', '', '']);
    expect(frame.vector).toBe('');
    expect(frame.arrow).toBe('');
  });

  it('keeps a point on the available axes and handles a vector parallel to an axis', () => {
    expect(clampPoint([-1, Infinity, 9])).toEqual([0, 0, 6]);
    const frame = pointFrame([0, 0, 5], view);
    expect(frame.angles).toEqual([90, 90, 0]);
    expect(frame.arcs[2]).toBe('');
    expect(frame.arcs.join('')).not.toContain('NaN');
  });
});
