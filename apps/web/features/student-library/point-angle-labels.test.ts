import { describe, expect, it } from 'vitest';
import { placeAngleLabels, segmentCrossesBox, type LabelBox } from './point-angle-labels';
import { pointGeometry } from './point-geometry.generated';
import { pointFrame, type Point2, type Point3 } from './point-position-model';

describe('angle labels without position switching', () => {
  const view = pointGeometry.view;
  const sizes: Point2[] = [[18, 17], [18, 17], [18, 17]];
  const bounds: Point2 = [500, 440];
  const frameAt = (point: Point3, obstacles: LabelBox[] = []) => placeAngleLabels(pointFrame(point, view).angleCurves, view.origin, [], obstacles, sizes, bounds);

  it('fades a blocked label without moving it to another candidate', () => {
    const initial = frameAt([2, 3.5, 4]);
    const point = initial[0]!.point;
    const blocked = frameAt([2, 3.5, 4], [{ x: point[0] - 20, y: point[1] - 20, width: 40, height: 40 }]);
    expect(blocked.map((label) => label?.point)).toEqual(initial.map((label) => label?.point));
    expect(initial[0]!.opacity).toBeGreaterThan(.9);
    expect(blocked[0]!.opacity).toBe(0);
  });

  it('tracks arcs continuously and omits zero or undefined angles', () => {
    for (const scale of [.56, .7, 1.2]) {
      let previous = frameAt([2, 3.5, 4]);
      for (let step = 1; step <= 300; step++) {
        const t = step / 300;
        const frame = pointFrame([2 + 3 * t, 3.5 - 3 * t, 4 - 3 * t], view);
        const current = placeAngleLabels(frame.angleCurves, view.origin, [], [], sizes, bounds, scale);
        if (step > 1) current.forEach((label, i) => {
          const old = previous[i];
          if (label && old) expect(Math.hypot(label.point[0] - old.point[0], label.point[1] - old.point[1])).toBeLessThan(1);
        });
        previous = current;
      }
    }
    expect(frameAt([0, 0, 0])).toEqual([null, null, null]);
    expect(frameAt([0, 0, 5])[2]).toBeNull();
  });

  it('rejects crossings and contacts, including vertical and zero-length segments', () => {
    const box = { x: 10, y: 10, width: 20, height: 20 };
    for (const segment of [[[0, 0], [40, 40]], [[20, 0], [20, 40]], [[10, 10], [10, 10]]] as const) expect(segmentCrossesBox(segment, box)).toBe(true);
    expect(segmentCrossesBox([[0, 0], [0, 40]], box)).toBe(false);
  });
});
