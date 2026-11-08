import type { Point2 } from './point-position-model';

export type LabelBox = { x: number; y: number; width: number; height: number };
type Segment = readonly [Point2, Point2];
const boxDistance = (a: LabelBox, b: LabelBox) => Math.hypot(Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width), Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height));
const pointDistance = ([x, y]: Point2, box: LabelBox) => boxDistance({ x, y, width: 0, height: 0 }, box);

export function segmentCrossesBox([a, b]: Segment, box: LabelBox) {
  let low = 0, high = 1;
  for (const axis of [0, 1] as const) {
    const min = axis === 0 ? box.x : box.y, max = min + (axis === 0 ? box.width : box.height);
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) return false; }
    else {
      const t0 = (min - a[axis]) / delta, t1 = (max - a[axis]) / delta;
      low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
      if (low > high) return false;
    }
  }
  return true;
}

function lineDistance([a, b]: Segment, box: LabelBox) {
  if (segmentCrossesBox([a, b], box)) return 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
  const distances = [pointDistance(a, box), pointDistance(b, box)];
  for (const x of [box.x, box.x + box.width]) for (const y of [box.y, box.y + box.height]) {
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared)) : 0;
    distances.push(Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return Math.min(...distances);
}

// Each label follows one fixed point of its arc. Clearance changes opacity, never position.
export function placeAngleLabels(curves: readonly (readonly Point2[])[], origin: Point2, segments: readonly Segment[], obstacles: readonly LabelBox[], sizes: readonly Point2[], bounds: Point2, scale = 1) {
  const positions = curves.map((curve, i): Point2 | null => {
    if (!curve.length) return null;
    const p = curve[i === 0 ? 8 : 16], dx = p[0] - origin[0], dy = p[1] - origin[1], length = Math.hypot(dx, dy) || 1;
    return [p[0] + dx / length * 16 / scale + (i === 0 ? 6 / scale : 0), p[1] + dy / length * 16 / scale];
  });
  const boxes = positions.map((p, i) => p && ({ x: p[0] - sizes[i][0] / 2, y: p[1] - sizes[i][1] / 2, width: sizes[i][0], height: sizes[i][1] }));
  return positions.map((point, i) => {
    const box = boxes[i];
    if (!point || !box) return null;
    let clearance = Math.min(box.x, box.y, bounds[0] - box.x - box.width, bounds[1] - box.y - box.height);
    for (const other of [...obstacles, ...boxes.filter((b, j): b is LabelBox => j !== i && b !== null)]) clearance = Math.min(clearance, boxDistance(box, other));
    for (const line of segments) clearance = Math.min(clearance, lineDistance(line, box));
    const ends = curves[i], arcLength = Math.hypot(ends[0][0] - ends[32][0], ends[0][1] - ends[32][1]);
    const fade = Math.max(0, Math.min(1, (clearance * scale - 2) / 5, arcLength * scale / 8));
    return { point, opacity: fade * fade * (3 - 2 * fade) };
  });
}
