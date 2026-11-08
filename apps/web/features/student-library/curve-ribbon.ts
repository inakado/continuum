import type { Point2 } from './point-position-model';

export const unitProgress = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const pair = ([x, y]: Point2) => `${x.toFixed(2)} ${y.toFixed(2)}`;
export const svgPath = (points: readonly Point2[]) => points.map((p, i) => `${i ? 'L' : 'M'}${pair(p)}`).join('');

export function ribbonGeometry(points: readonly Point2[], widthAt: (progress: number) => number) {
  const last = points.length - 1;
  const edges = points.map((p, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(last, i + 1)];
    const dx = after[0] - before[0], dy = after[1] - before[1];
    const half = widthAt(i / last) / 2 / (Math.hypot(dx, dy) || 1);
    return { left: [p[0] - dy * half, p[1] + dx * half] as Point2, right: [p[0] + dy * half, p[1] - dx * half] as Point2 };
  });
  return { points, edges };
}

export function ribbonAt(value: number, geometry: ReturnType<typeof ribbonGeometry>) {
  const progress = unitProgress(value), last = geometry.points.length - 1, sample = progress * last;
  const index = Math.min(last - 1, Math.floor(sample)), mix = sample - index;
  const lerp = (a: Point2, b: Point2): Point2 => [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix];
  const point = lerp(geometry.points[index], geometry.points[index + 1]);
  const left = geometry.edges.slice(0, index + 1).map((e) => e.left);
  const right = geometry.edges.slice(0, index + 1).map((e) => e.right);
  left.push(lerp(geometry.edges[index].left, geometry.edges[index + 1].left));
  right.push(lerp(geometry.edges[index].right, geometry.edges[index + 1].right));
  return { point, trail: progress ? `${svgPath([...left, ...right.reverse()])}Z` : '', index, mix };
}

export function svgVector(from: Point2, to: Point2, labelOffset = 32) {
  const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
  const ux = dx / (length || 1), uy = dy / (length || 1);
  const tip: Point2 = [to[0] - ux * 5, to[1] - uy * 5];
  return {
    vector: length ? svgPath([from, to]) : '',
    arrow: length < 18 ? '' : `${svgPath([tip, [tip[0] - ux * 9 - uy * 3.5, tip[1] - uy * 9 + ux * 3.5], [tip[0] - ux * 9 + uy * 3.5, tip[1] - uy * 9 - ux * 3.5]])}Z`,
    label: [(from[0] + to[0]) / 2 - uy * labelOffset, (from[1] + to[1]) / 2 + ux * labelOffset + 5] as Point2,
    visible: length >= 18,
  };
}
