export type Point3 = readonly [number, number, number];
export type Point2 = readonly [number, number];
export type PointAxis = 0 | 1 | 2;
export type PointView = { origin: Point2; axes: readonly [Point2, Point2, Point2] };
export const INITIAL_POINT: Point3 = [2, 3.5, 4];
export const POINT_LIMIT = 6;

export function clampPoint([x, y, z]: Point3): Point3 {
  const clamp = (value: number) => Math.min(POINT_LIMIT, Math.max(0, Number.isFinite(value) ? value : 0));
  return [clamp(x), clamp(y), clamp(z)];
}

export function projectPoint([x, y, z]: Point3, view: PointView): Point2 {
  return [
    view.origin[0] + x * view.axes[0][0] + y * view.axes[1][0] + z * view.axes[2][0],
    view.origin[1] + x * view.axes[0][1] + y * view.axes[1][1] + z * view.axes[2][1],
  ];
}

export function dragPointXY(point: Point3, [dx, dy]: Point2, view: PointView): Point3 {
  const [a, b] = view.axes;
  const determinant = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(determinant) < 1e-9) return point;
  return clampPoint([
    point[0] + (dx * b[1] - dy * b[0]) / determinant,
    point[1] + (dy * a[0] - dx * a[1]) / determinant,
    point[2],
  ]);
}

export function dragPointVertical(point: Point3, [dx, dy]: Point2, view: PointView): Point3 {
  if (Math.abs(view.axes[2][1]) < 1e-9) return point;
  const [x, y] = dragPointXY(point, [dx, 0], view);
  return clampPoint([x, y, point[2] + dy / view.axes[2][1]]);
}

export function dragPointAxis(point: Point3, [dx, dy]: Point2, axis: PointAxis, view: PointView): Point3 {
  const [ax, ay] = view.axes[axis], lengthSquared = ax * ax + ay * ay;
  if (lengthSquared < 1e-9) return point;
  const next: [number, number, number] = [...point];
  next[axis] += (dx * ax + dy * ay) / lengthSquared;
  return clampPoint(next);
}

const number = (value: number) => String(Math.round(value * 100) / 100);
const pathOf = (points: readonly Point2[], closed = false) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${number(x)} ${number(y)}`).join('') + (closed ? 'Z' : '');

function angleArc(point: Point3, axis: number, radius: number, view: PointView) {
  const length = Math.hypot(...point);
  if (length < 1e-9) return [];
  const unit = point.map((value) => value / length);
  const angle = Math.acos(Math.max(-1, Math.min(1, unit[axis])));
  if (angle < 1e-6) return [];
  const sine = Math.sin(angle);
  const tangent = unit.map((value, i) => (value - (i === axis ? Math.cos(angle) : 0)) / sine);
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = angle * i / 32;
    const p = tangent.map((value, j) => radius * ((j === axis ? Math.cos(t) : 0) + value * Math.sin(t)));
    return projectPoint([p[0], p[1], p[2]], view);
  });
  return points;
}

export function pointFrame(point: Point3, view: PointView, pixelsPerUnit = 1) {
  const [x, y, z] = point;
  const world: readonly Point3[] = [[0, 0, 0], [x, 0, 0], [0, y, 0], [0, 0, z], [x, y, 0], [x, 0, z], [0, y, z], point];
  const p = world.map((value) => projectPoint(value, view));
  const pairs = [[1, 4], [2, 4], [4, 7], [1, 5], [3, 5], [5, 7], [2, 6], [3, 6], [6, 7]];
  const length = Math.hypot(x, y, z);
  const angles = point.map((value) => length < 1e-9 ? null : Math.acos(Math.max(-1, Math.min(1, value / length))) * 180 / Math.PI);
  const dx = p[7][0] - p[0][0];
  const dy = p[7][1] - p[0][1];
  const screenLength = Math.hypot(dx, dy);
  const ux = dx / (screenLength || 1);
  const uy = dy / (screenLength || 1);
  const head = 9 / pixelsPerUnit;
  const tip: Point2 = [p[7][0] - ux * 5 / pixelsPerUnit, p[7][1] - uy * 5 / pixelsPerUnit];
  const arrow = screenLength * pixelsPerUnit < 18 ? '' : pathOf([
    tip,
    [tip[0] - ux * head - uy * head * .43, tip[1] - uy * head + ux * head * .43],
    [tip[0] - ux * head + uy * head * .43, tip[1] - uy * head - ux * head * .43],
  ], true);
  const angleCurves = [0, 1, 2].map((axis) => angleArc(point, axis, [1.1, 1.55, 2][axis] * Math.min(1, length / 3), view));
  return {
    point: p[7], feet: [p[1], p[2], p[3]], length, angles,
    plane: pathOf([p[0], p[1], p[4], p[2]], true),
    projections: pairs.map(([a, b]) => pathOf([p[a], p[b]])).join(''),
    coordinatePaths: [1, 2, 3].map((index) => pathOf([p[0], p[index]])),
    vector: length < 1e-9 ? '' : pathOf([p[0], p[7]]), arrow,
    vectorLabel: [(p[0][0] + p[7][0]) / 2, (p[0][1] + p[7][1]) / 2] as Point2,
    arcs: angleCurves.map((curve) => pathOf(curve)), angleCurves,
  };
}

export const pointNumber = (value: number) => value.toFixed(2).replace('.', ',');
